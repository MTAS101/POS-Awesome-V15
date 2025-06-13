export default {
    install(app, { vuetify }) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const stored = localStorage.getItem('posawesome-theme');
        const current = stored || (prefersDark ? 'dark' : 'light');

        // apply initial theme
        vuetify.theme.global.name.value = current;
        document.documentElement.classList.toggle('dark-theme', current === 'dark');

        const toggle = () => {
            const newTheme = vuetify.theme.global.name.value === 'dark' ? 'light' : 'dark';
            vuetify.theme.global.name.value = newTheme;
            document.documentElement.classList.toggle('dark-theme', newTheme === 'dark');
            localStorage.setItem('posawesome-theme', newTheme);
        };

        app.config.globalProperties.$theme = {
            get current() {
                return vuetify.theme.global.name.value;
            },
            toggle,
        };
    }
};
