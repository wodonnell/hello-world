(function () {
  'use strict';

  var app = angular.module('medTrackerApp', []);

  app.controller('MainController', ['$http', '$timeout', function ($http, $timeout) {
    var vm = this;

    // View state
    vm.activeTab = 'inventory'; // 'inventory' or 'dosette'
    vm.filterCategory = 'all'; // 'all', 'lowStock', 'dosette'
    vm.searchQuery = '';
    vm.medications = [];
    vm.displayedMedications = [];
    vm.lowStockItems = [];
    vm.stats = {
      totalMedications: 0,
      lowStockCount: 0,
      dosetteCount: 0
    };

    // Toasts
    vm.toasts = [];

    // Modal state for Add/Edit
    vm.showModal = false;
    vm.isEditing = false;
    vm.formData = {};

    // Modal state for custom stock adjustment
    vm.showCustomAdjustModal = false;
    vm.customAdjustMed = null;
    vm.customAdjustAmount = 0;
    vm.customAdjustReason = '';

    // Dosette Checklist state
    vm.daysOfWeek = [
      { name: 'Monday', short: 'Mon' },
      { name: 'Tuesday', short: 'Tue' },
      { name: 'Wednesday', short: 'Wed' },
      { name: 'Thursday', short: 'Thu' },
      { name: 'Friday', short: 'Fri' },
      { name: 'Saturday', short: 'Sat' },
      { name: 'Sunday', short: 'Sun' }
    ];
    vm.selectedDayIndex = 0;
    // Map of 'dayIndex-timeSlot-medId' -> boolean
    vm.checklistState = {};

    // Load initial data
    vm.init = function () {
      vm.loadChecklistFromStorage();
      vm.loadStats();
      vm.loadMedications();
    };

    // --- TOAST NOTIFICATIONS ---
    vm.showToast = function (message, type) {
      type = type || 'success';
      var icon = '✅';
      if (type === 'warning') icon = '⚠️';
      if (type === 'danger') icon = '❌';

      var toast = { message: message, type: type, icon: icon };
      vm.toasts.push(toast);

      $timeout(function () {
        var index = vm.toasts.indexOf(toast);
        if (index !== -1) {
          vm.toasts.splice(index, 1);
        }
      }, 3500);
    };

    // --- TAB SWITCHING ---
    vm.setActiveTab = function (tab) {
      vm.activeTab = tab;
    };

    // --- STATS & MEDICATIONS API ---
    vm.loadStats = function () {
      $http.get('/api/stats')
        .then(function (res) {
          vm.stats = res.data;
        })
        .catch(function (err) {
          console.error('Error loading stats:', err);
        });
    };

    vm.loadMedications = function () {
      $http.get('/api/medications')
        .then(function (res) {
          vm.medications = res.data;
          vm.filterMedications();
          vm.updateLowStockBanner();
        })
        .catch(function (err) {
          console.error('Error loading medications:', err);
          vm.showToast('Failed to load medications', 'danger');
        });
    };

    vm.updateLowStockBanner = function () {
      vm.lowStockItems = vm.medications.filter(function (med) {
        return med.current_stock <= med.reorder_threshold;
      });
    };

    // --- FILTER & SEARCH ---
    vm.setFilterCategory = function (category) {
      vm.filterCategory = category;
      vm.filterMedications();
    };

    vm.filterMedications = function () {
      var filtered = vm.medications;

      // Category filter
      if (vm.filterCategory === 'lowStock') {
        filtered = filtered.filter(function (med) {
          return med.current_stock <= med.reorder_threshold;
        });
      } else if (vm.filterCategory === 'dosette') {
        filtered = filtered.filter(function (med) {
          return med.is_dosette === 1;
        });
      }

      // Search text filter
      if (vm.searchQuery && vm.searchQuery.trim() !== '') {
        var q = vm.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(function (med) {
          return (med.name && med.name.toLowerCase().indexOf(q) !== -1) ||
                 (med.dosage && med.dosage.toLowerCase().indexOf(q) !== -1) ||
                 (med.form && med.form.toLowerCase().indexOf(q) !== -1) ||
                 (med.schedule_notes && med.schedule_notes.toLowerCase().indexOf(q) !== -1);
        });
      }

      vm.displayedMedications = filtered;
    };

    // --- VISUAL PROGRESS BARS ---
    vm.getProgressWidth = function (med) {
      if (!med) return '0%';
      // Baseline calculation: stock / (threshold * 2.5 or pack_size)
      var maxTarget = Math.max(med.reorder_threshold * 2.5, med.pack_size || 30, 20);
      var pct = Math.min(100, Math.round((med.current_stock / maxTarget) * 100));
      return Math.max(4, pct) + '%';
    };

    vm.getProgressClass = function (med) {
      if (!med) return 'progress-green';
      if (med.current_stock <= med.reorder_threshold) {
        return 'progress-red';
      }
      if (med.current_stock <= med.reorder_threshold * 1.5) {
        return 'progress-yellow';
      }
      return 'progress-green';
    };

    // --- QUICK STOCK ADJUSTMENTS ---
    vm.quickAdjust = function (med, action) {
      $http.post('/api/medications/' + med.id + '/adjust-stock', { action: action })
        .then(function (res) {
          var updated = res.data.medication;
          // Update in local arrays
          vm.replaceMedicationInLocal(updated);
          vm.loadStats();
          vm.updateLowStockBanner();
          vm.filterMedications();

          if (action === 'dose') {
            vm.showToast(med.name + ': dose taken (-1). Stock now ' + updated.current_stock, 'success');
          } else if (action === 'pack') {
            vm.showToast(med.name + ': restocked pack (+' + med.pack_size + '). Stock now ' + updated.current_stock, 'success');
          }
        })
        .catch(function (err) {
          console.error('Error adjusting stock:', err);
          vm.showToast('Could not adjust stock', 'danger');
        });
    };

    // --- CUSTOM ADJUST MODAL ---
    vm.openCustomAdjustModal = function (med) {
      vm.customAdjustMed = med;
      vm.customAdjustAmount = null;
      vm.customAdjustReason = '';
      vm.showCustomAdjustModal = true;
    };

    vm.closeCustomAdjustModal = function () {
      vm.showCustomAdjustModal = false;
      vm.customAdjustMed = null;
    };

    vm.submitCustomAdjust = function () {
      if (!vm.customAdjustMed || vm.customAdjustAmount === null || vm.customAdjustAmount === undefined) {
        return;
      }
      $http.post('/api/medications/' + vm.customAdjustMed.id + '/adjust-stock', {
        action: 'custom',
        amount: vm.customAdjustAmount,
        reason: vm.customAdjustReason
      })
      .then(function (res) {
        var updated = res.data.medication;
        vm.replaceMedicationInLocal(updated);
        vm.loadStats();
        vm.updateLowStockBanner();
        vm.filterMedications();
        vm.closeCustomAdjustModal();
        vm.showToast('Stock updated for ' + updated.name + ' to ' + updated.current_stock, 'success');
      })
      .catch(function (err) {
        console.error('Error updating stock:', err);
        vm.showToast('Failed to update stock', 'danger');
      });
    };

    // --- ADD / EDIT MEDICATION MODAL ---
    vm.openAddModal = function () {
      vm.isEditing = false;
      vm.formData = {
        name: '',
        dosage: '',
        form: 'tablet',
        current_stock: 30,
        reorder_threshold: 10,
        pack_size: 28,
        schedule_notes: '',
        instructions: '',
        is_dosette: 0,
        dosette_morning: 0,
        dosette_noon: 0,
        dosette_evening: 0,
        dosette_bedtime: 0
      };
      vm.showModal = true;
    };

    vm.openEditModal = function (med) {
      vm.isEditing = true;
      vm.formData = angular.copy(med);
      vm.showModal = true;
    };

    vm.closeModal = function () {
      vm.showModal = false;
      vm.formData = {};
    };

    vm.saveMedication = function () {
      if (vm.isEditing) {
        $http.put('/api/medications/' + vm.formData.id, vm.formData)
          .then(function (res) {
            vm.replaceMedicationInLocal(res.data);
            vm.loadStats();
            vm.updateLowStockBanner();
            vm.filterMedications();
            vm.closeModal();
            vm.showToast('Updated medication: ' + res.data.name, 'success');
          })
          .catch(function (err) {
            console.error('Error updating medication:', err);
            vm.showToast('Failed to update medication', 'danger');
          });
      } else {
        $http.post('/api/medications', vm.formData)
          .then(function (res) {
            vm.medications.push(res.data);
            vm.loadStats();
            vm.updateLowStockBanner();
            vm.filterMedications();
            vm.closeModal();
            vm.showToast('Added medication: ' + res.data.name, 'success');
          })
          .catch(function (err) {
            console.error('Error adding medication:', err);
            vm.showToast('Failed to add medication', 'danger');
          });
      }
    };

    vm.deleteMedication = function (med) {
      if (!confirm('Are you sure you want to remove ' + med.name + ' from your inventory?')) {
        return;
      }
      $http.delete('/api/medications/' + med.id)
        .then(function () {
          vm.medications = vm.medications.filter(function (m) { return m.id !== med.id; });
          vm.loadStats();
          vm.updateLowStockBanner();
          vm.filterMedications();
          vm.showToast('Removed ' + med.name, 'warning');
        })
        .catch(function (err) {
          console.error('Error deleting medication:', err);
          vm.showToast('Failed to delete medication', 'danger');
        });
    };

    vm.replaceMedicationInLocal = function (updatedMed) {
      for (var i = 0; i < vm.medications.length; i++) {
        if (vm.medications[i].id === updatedMed.id) {
          vm.medications[i] = updatedMed;
          break;
        }
      }
    };

    // --- DOSETTE CHECKLIST LOGIC ---
    vm.selectDay = function (index) {
      vm.selectedDayIndex = index;
    };

    vm.getSlotMedications = function (slot) {
      var col = 'dosette_' + slot;
      return vm.medications.filter(function (med) {
        return med.is_dosette === 1 && med[col] === 1;
      });
    };

    vm.isSlotChecked = function (dayIndex, slot, medId) {
      var key = dayIndex + '-' + slot + '-' + medId;
      return !!vm.checklistState[key];
    };

    vm.toggleSlotCheck = function (dayIndex, slot, medId) {
      var key = dayIndex + '-' + slot + '-' + medId;
      vm.checklistState[key] = !vm.checklistState[key];
      vm.saveChecklistToStorage();
    };

    vm.getDayCompletionStatus = function (dayIndex) {
      var slots = ['morning', 'noon', 'evening', 'bedtime'];
      var total = 0;
      var checked = 0;

      for (var s = 0; s < slots.length; s++) {
        var slotMeds = vm.getSlotMedications(slots[s]);
        total += slotMeds.length;
        for (var m = 0; m < slotMeds.length; m++) {
          var key = dayIndex + '-' + slots[s] + '-' + slotMeds[m].id;
          if (vm.checklistState[key]) {
            checked++;
          }
        }
      }

      if (total === 0) return 'No items';
      if (checked === total) return '✓ All packed';
      return checked + ' / ' + total + ' packed';
    };

    vm.resetDosetteChecklist = function () {
      if (confirm('Reset all checklist marks for the weekly dosette box?')) {
        vm.checklistState = {};
        vm.saveChecklistToStorage();
        vm.showToast('Dosette checklist cleared for a new week', 'success');
      }
    };

    vm.packEntireWeek = function () {
      if (!confirm('This will record packing for all dosette items and deduct 7 days worth from your stock counts. Proceed?')) {
        return;
      }

      $http.post('/api/dosette/pack-week', {})
        .then(function (res) {
          // Mark all dosette items as packed in the checklist
          var slots = ['morning', 'noon', 'evening', 'bedtime'];
          for (var day = 0; day < 7; day++) {
            for (var s = 0; s < slots.length; s++) {
              var meds = vm.getSlotMedications(slots[s]);
              for (var m = 0; m < meds.length; m++) {
                vm.checklistState[day + '-' + slots[s] + '-' + meds[m].id] = true;
              }
            }
          }
          vm.saveChecklistToStorage();

          // Refresh medication inventory and stats
          vm.loadMedications();
          vm.loadStats();

          vm.showToast('Successfully packed 7-day dosette box and updated stock inventory!', 'success');
        })
        .catch(function (err) {
          console.error('Error packing week:', err);
          vm.showToast('Failed to complete weekly packing', 'danger');
        });
    };

    vm.saveChecklistToStorage = function () {
      try {
        localStorage.setItem('medtrack_dosette_checklist', JSON.stringify(vm.checklistState));
      } catch (e) {}
    };

    vm.loadChecklistFromStorage = function () {
      try {
        var saved = localStorage.getItem('medtrack_dosette_checklist');
        if (saved) {
          vm.checklistState = JSON.parse(saved);
        }
      } catch (e) {}
    };

    // Run on startup
    vm.init();
  }]);
})();
