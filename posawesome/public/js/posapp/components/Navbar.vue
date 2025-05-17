<template>
  <nav>
    <!-- Top App Bar -->
    <v-app-bar app flat height="56" color="white" class="border-bottom">
      <v-app-bar-nav-icon ref="navIcon" @click="drawer = !drawer" class="text-secondary" />

      <v-img src="/assets/posawesome/js/posapp/components/pos/pos.png" alt="POS Awesome" max-width="32" class="mx-3" />

      <v-toolbar-title @click="go_desk" class="text-h6 font-weight-bold text-primary" style="cursor: pointer;">
        <span class="font-weight-light">POS</span><span>Awesome</span>
      </v-toolbar-title>

      <v-spacer />

      <v-btn style="cursor: unset; text-transform: none;" variant="text" color="primary">
        <span right>{{ pos_profile.name }}</span>
      </v-btn>

      <v-menu offset-y offset-x :min-width="200">
        <template #activator="{ props }">
          <v-btn v-bind="props" color="primary" theme="dark" variant="text" class="user-menu-btn">
            {{ __('Menu') }}
            <v-icon right>mdi-menu-down</v-icon>
          </v-btn>
        </template>

        <v-card class="user-menu-card" tile>
          <v-list dense class="user-menu-list">
            <v-list-item v-if="!pos_profile.posa_hide_closing_shift" @click="close_shift_dialog" class="user-menu-item">
              <v-list-item-icon>
                <v-icon>mdi-content-save-move-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ __('Close Shift') }}</v-list-item-title>
            </v-list-item>

            <v-list-item v-if="pos_profile.posa_allow_print_last_invoice && last_invoice" @click="print_last_invoice"
              class="user-menu-item">
              <v-list-item-icon>
                <v-icon>mdi-printer</v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ __('Print Last Invoice') }}</v-list-item-title>
            </v-list-item>

            <v-divider class="my-2" />

            <v-list-item @click="logOut" class="user-menu-item">
              <v-list-item-icon>
                <v-icon>mdi-logout</v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ __('Logout') }}</v-list-item-title>
            </v-list-item>

            <v-list-item @click="go_about" class="user-menu-item">
              <v-list-item-icon>
                <v-icon>mdi-information-outline</v-icon>
              </v-list-item-icon>
              <v-list-item-title>{{ __('About') }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer app v-model="drawer" :mini-variant="mini" expand-on-hover width="220" class="drawer-custom"
      @mouseleave="drawer = false; mini = true">
      <!-- Drawer Header (expanded) -->
      <div v-if="!mini" class="drawer-header">
        <v-avatar size="40">
          <v-img :src="company_img" alt="Company logo" />
        </v-avatar>
        <span class="drawer-company">{{ company }}</span>
        <v-btn icon @click.stop="mini = !mini">
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
      </div>
      <!-- Drawer Header (mini) -->
      <div v-else class="drawer-header-mini">
        <v-avatar size="40">
          <v-img :src="company_img" alt="Company logo" />
        </v-avatar>
      </div>

      <v-divider />

      <v-list dense nav>
        <v-list-item-group v-model="item" active-class="active-item">
          <v-list-item v-for="i in items" :key="i.text" @click="changePage(i.text)" class="drawer-item">
            <v-list-item-icon>
              <v-icon class="drawer-icon">{{ i.icon }}</v-icon>
            </v-list-item-icon>
            <v-list-item-content v-if="!mini">
              <v-list-item-title class="drawer-item-title">
                {{ i.text }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-navigation-drawer>

    <!-- Snack and Dialog -->
    <v-snackbar v-model="snack" :timeout="5000" :color="snackColor" location="top right">
      {{ snackText }}
    </v-snackbar>

    <v-dialog v-model="freeze" persistent max-width="290">
      <v-card>
        <v-card-title class="text-h5">{{ freezeTitle }}</v-card-title>
        <v-card-text>{{ freezeMsg }}</v-card-text>
      </v-card>
    </v-dialog>
  </nav>
</template>

<script>
export default {
  data() {
    return {
      drawer: false,
      mini: true,
      item: 0,
      items: [{ text: 'POS', icon: 'mdi-network-pos' }],
      page: '',
      fav: true,
      menu: false,
      message: false,
      hints: true,
      menu_item: 0,
      snack: false,
      snackColor: '',
      snackText: '',
      company: 'POS Awesome',
      company_img: '/assets/erpnext/images/erpnext-logo.svg',
      pos_profile: '',
      freeze: false,
      freezeTitle: '',
      freezeMsg: '',
      last_invoice: '',
      closeTimeout: null,
    };
  },
  created() {
    // use boot company if available, otherwise keep default
    const bootCompany = frappe.boot.user_info && frappe.boot.user_info.company;
    this.company = bootCompany || this.company;

    // fetch company logo
    if (this.company && this.company !== 'POS Awesome') {
      frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Company', name: this.company },
        callback: r => {
          if (r.message && r.message.company_logo) {
            this.company_img = r.message.company_logo;
          }
        }
      });
    }

    // existing event registrations
    this.$nextTick(() => {
      this.eventBus.on('show_message', this.show_message);
      this.eventBus.on('set_company', data => {
        this.company = data.name || this.company;
        this.company_img = data.company_logo || this.company_img;
      });
      this.eventBus.on('register_pos_profile', data => {
        this.pos_profile = data.pos_profile;
        const payments = { text: 'Payments', icon: 'mdi-cash-register' };
        if (this.pos_profile.posa_use_pos_awesome_payments && this.items.length !== 2) {
          this.items.push(payments);
        }
      });
      this.eventBus.on('set_last_invoice', data => (this.last_invoice = data));
      this.eventBus.on('freeze', data => { this.freeze = true; this.freezeTitle = data.title; this.freezeMsg = data.msg; });
      this.eventBus.on('unfreeze', () => { this.freeze = false; this.freezeTitle = ''; this.freezeMsg = ''; });
    });
  },
  methods: {
    changePage(key) {
      this.$emit('changePage', key);
    },
    go_desk() {
      frappe.set_route('/'); location.reload();
    },
    go_about() {
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_app_info',
        callback: r => {
          if (r.message && Array.isArray(r.message.apps)) {
            let html = `
              <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                  <tr>
                    <th style="padding:8px;">${__('Application')}</th>
                    <th style="padding:8px;">${__('Version')}</th>
                  </tr>
                </thead>
                <tbody>
            `;
            r.message.apps.forEach(app => {
              html += `
                  <tr>
                    <td style="padding:8px;"><strong>${app.app_name}</strong></td>
                    <td style="padding:8px;">${app.installed_version}</td>
                  </tr>
              `;
            });
            html += `
                </tbody>
              </table>
            `;

            frappe.msgprint({ title: __('Installed Applications'), indicator: 'blue', message: html });
          }
        },
        error: () => frappe.msgprint({ title: __('Error'), indicator: 'red', message: __('Failed to retrieve app info') })
      });
    },
    close_shift_dialog() { this.eventBus.emit('open_closing_dialog'); },
    show_message(data) { this.snack = true; this.snackColor = data.color; this.snackText = data.title; },
    logOut() {
      let me = this; me.logged_out = true;
      return frappe.call({ method: 'logout', callback: r => { if (!r.exc) { frappe.set_route('/app/home'); location.reload(); } } });
    },
    print_last_invoice() {
      if (!this.last_invoice) return;
      const pf = this.pos_profile.print_format_for_online || this.pos_profile.print_format;
      const lh = this.pos_profile.letter_head || 0;
      const url = `${frappe.urllib.get_base_url()}/printview?doctype=Sales%20Invoice&name=${this.last_invoice}&trigger_print=1&format=${pf}&no_letterhead=${lh}`;
      const pw = window.open(url, 'Print'); pw.addEventListener('load', () => pw.print(), true);
    },
    handleNavClick() { this.drawer = true; this.mini = false; },
    handleMouseLeave() { if (!this.drawer) return; this.closeTimeout = setTimeout(() => { this.drawer = false; this.mini = true; }, 250); },
    triggerNavClick() { if (!this.drawer) this.$refs.navIcon.$el.click(); }
  }
};
</script>

<style scoped>
.border-bottom {
  border-bottom: 1px solid #e0e0e0;
}

.text-secondary {
  color: rgba(0, 0, 0, 0.6) !important;
}

.drawer-custom {
  background-color: #fafafa;
  transition: all 0.3s ease-out;
}

.drawer-header {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
}

.drawer-header-mini {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 64px;
}

.drawer-company {
  margin-left: 12px;
  flex: 1;
  font-weight: 500;
  font-size: 1rem;
  color: #424242;
}

.drawer-icon {
  font-size: 24px;
  color: #1976d2;
}

.drawer-item-title {
  margin-left: 8px;
  font-weight: 500;
  color: #424242;
}

.v-list-item:hover {
  background-color: rgba(25, 118, 210, 0.1) !important;
}

.active-item {
  background-color: rgba(25, 118, 210, 0.2) !important;
}

.user-menu-btn {
  text-transform: none;
  padding: 4px 12px;
  font-weight: 500;
}

.user-menu-card {
  border-radius: 8px;
  overflow: hidden;
}

.user-menu-list {
  padding-top: 8px;
  padding-bottom: 8px;
}

.user-menu-item {
  padding: 10px 16px;
}

.user-menu-item .v-list-item-icon {
  min-width: 36px;
}

.user-menu-card .v-divider {
  margin: 8px 0;
}
</style>
