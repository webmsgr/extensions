!function () {
    const ENGLISH_DISPLAY_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

    function simpleLanguageName(language) {
        return language === "all" ? "All" : ENGLISH_DISPLAY_NAMES.of(language);
    }

    function languageName(language) {
        if (language === "all") {
            return "All";
        }

        if (language === "en") {
            return "English"
        }

        const localDisplayNames = new Intl.DisplayNames([language], { type: "language" });

        return `${ENGLISH_DISPLAY_NAMES.of(language)} - ${localDisplayNames.of(language)}`;
    }

    const LoadingStatus = {
        Loading: "loading",
        Loaded: "loaded",
        Error: "error",
    }

    const NsfwOption = {
        All: "all",
        Safe: "safe",
        Nsfw: "nsfw",
    }

    document.addEventListener("alpine:init", () => {
        Alpine.directive("virtual", (template_el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluateLater }) => {
            console.log("setting up virtual list with template", template_el)
            let el = document.createElement("div");
            //el.setAttribute("x-data", "{}");
            template_el.parentElement.appendChild(el);
            //el.style.flexGrow = 1;
            //el.style.height = + "px";
            console.log("setting up virtual list under", el)
            let [raw_key, bind_name] = expression.split(":");
            let getKeyData = evaluateLater(raw_key);

            function createElement(index) {
                const element = document.createElement('div');
                element.style.width = '100%';
                element.appendChild(template_el.content.cloneNode(true));
                getKeyData(key => {
                    element.setAttribute("x-data", JSON.stringify({[bind_name]: key[index]}));
                })
                return element;
            }
            let list = null;
            function updateList() {
                getKeyData(key => {
                    let options = {
                        width: '100%',
                        height: window.innerHeight - el.offsetTop ,
                        itemHeight: 55, // aprox
                        generate: createElement,
                        total: key.length
                    }
                    if (list === null) {
                        list = new HyperList(el, options);
                        // this causes alpine to actually init the elements on first render
                        // if you don't do this, you need to scroll for anything to show up (bad ux)
                        setTimeout(() => Alpine.initTree(el), 0);
                        if (document.location.hash) {
                            let scroll_to = document.location.hash.substring(1);
                            // find that in the list
                            let index = key.findIndex((i) => i.pkg.replace('eu.kanade.tachiyomi.extension.', '') == scroll_to);
                            if (index > -1) {
                                // from https://github.com/tbranyen/hyperlist/issues/48#issuecomment-1495185044
                                console.log("scrolling to", index, list._itemPositions[index])
                                list._config.overrideScrollPosition = () => list._itemPositions[index] 
                                list._renderChunk()
                                list._config.overrideScrollPosition = null
                                el.scrollTo(0, list._itemPositions[index])
                            }
                        }
                    } else {
                        list.refresh(el, options);
                    }
                })
            }
            effect(() => {
                updateList();
            })
            window.addEventListener('resize', updateList);
            cleanup(() => {
                window.removeEventListener('resize', updateList);

            })
            
        })
        Alpine.store("repoUrl", "https://raw.githubusercontent.com/keiyoushi/extensions/repo");

        Alpine.data("extensionList", () => ({
            LoadingStatus,
            NsfwOption,
            simpleLanguageName,
            languageName,
            extensions: [],
            languages: [],
            loading: LoadingStatus.Loading,
            filtered: [],
            query: "",
            selectedLanguages: [],
            nsfw: NsfwOption.All,

            async init() {
                try {
                    const index = await fetch(`${Alpine.store("repoUrl")}/index.min.json`).then((e) => e.json());

                    this.extensions = index.sort((a, b) => {
                        if ("all" === a.lang && "all" !== b.lang) {
                            return -1;
                        }

                        if ("all" !== a.lang && "all" === b.lang) {
                            return 1;
                        }

                        if ("en" === a.lang && "en" !== b.lang) {
                            return -1
                        }

                        if ("en" === b.lang && "en" !== a.lang) {
                            return 1;
                        }

                        const langA = simpleLanguageName(a.lang);
                        const langB = simpleLanguageName(b.lang);

                        return langA.localeCompare(langB) || a.name.localeCompare(b.name);
                    });
                    this.languages = [...new Set(this.extensions.map((e) => e.lang))];
                    this.loading = LoadingStatus.Loaded;
                } catch (e) {
                    console.error(e);

                    this.loading = LoadingStatus.Error;
                }

                if (this.filtered.length === 0) {
                    this.updateFilteredList();
                }

                this.$nextTick(() => {
                    window.location.hash && window.location.replace(window.location.hash);
                });

            },

            updateFilteredList() {
                this.filtered = this.extensions
                    .filter(
                        (e) => !this.query 
                            || e.name.toLowerCase().includes(this.query.toLowerCase()) 
                            || e.pkg.toLowerCase().includes(this.query.toLowerCase()),
                    )
                    .filter(
                        (e) => this.nsfw === NsfwOption.All 
                            || (this.nsfw === NsfwOption.Nsfw ? e.nsfw : !e.nsfw),
                    )
                    .filter(
                        (e) =>
                            !this.selectedLanguages.length || this.selectedLanguages.includes(e.lang)
                    );
            },
        }))
    });
}()
