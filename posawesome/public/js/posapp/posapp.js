import { createVuetify } from 'vuetify';
import { createApp } from 'vue';
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
import eventBus from './bus';
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import Home from './Home.vue';

frappe.provide('frappe.PosApp');


frappe.PosApp.posapp = class {
    constructor({ parent }) {
        this.$parent = $(document);
        this.page = parent.page;
        this.make_body();

    }
    make_body() {
        this.$el = this.$parent.find('.main-section');
        const vuetify = createVuetify(
            {
                components,
                directives,
                locale: {
                    rtl: frappe.utils.is_rtl()
                },
                theme: {
                    defaultTheme: localStorage.getItem('posa_dark_mode') === 'true' ? 'dark' : 'light',
                    themes: {
                        light: {
                            background: '#FFFFFF',
                            primary: '#0097A7',
                            secondary: '#00BCD4',
                            accent: '#9575CD',
                            success: '#66BB6A',
                            info: '#2196F3',
                            warning: '#FF9800',
                            error: '#E86674',
                            orange: '#E65100',
                            golden: '#A68C59',
                            badge: '#F5528C',
                            customPrimary: '#085294',
                        },
                        dark: {
                            dark: true,
                            colors: {
                                background: '#000000'
                            }
                        }
                    },
                },
            }
        );
        const app = createApp(Home)
        app.component('VueDatePicker', VueDatePicker)
        app.use(eventBus);
        app.use(vuetify)
        app.mount(this.$el[0]);

        if (!document.querySelector('link[rel="manifest"]')) {
            const link = document.createElement('link');
            link.rel = 'manifest';
            link.href = '/manifest.json';
            document.head.appendChild(link);
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .catch(err => console.error('SW registration failed', err));
        }
    }
    setup_header() {

    }

};
