(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function i(r){const i=getContext("tinro");i&&(i.exact||i.fallback)&&function(t){throw new Error(t)}(`${r.fallback?"<Route fallback>":`<Route path="${r.path}">`}  can't be inside ${i.fallback?"<Route fallback>":`<Route path="${i.path||"/"}"> with exact path`}`);const o=r.fallback?"fallbacks":"childs",l={un:null,exact:!1,pattern:"",params:{},parent:i,fallback:r.fallback,redirect:r.redirect,childs:new Set,activeChilds:new Set,fallbacks:new Set,makePattern(t){l.exact=!t.endsWith("/*"),l.pattern=c(`${l.parent&&l.parent.pattern||""}${t}`);},register:()=>{if(l.parent)return l.parent[o].add(l),()=>{l.parent[o].delete(l),l.un&&l.un();}},show:()=>{r.onShow(),!l.fallback&&l.parent&&l.parent.activeChilds.add(l);},hide:()=>{r.onHide(),!l.fallback&&l.parent&&l.parent.activeChilds.delete(l);},match:async t=>{const a=s(l.pattern,t);if(a&&l.redirect&&(!l.exact||l.exact&&a.exact))return h.goto(function(t,e,a){if(""===a)return t;if("/"===a[0])return a;const n=t=>t.split("/").filter(t=>""!==t),r=n(t);return "/"+n(e).map((t,e)=>r[e]).join("/")+"/"+a}(t,l.parent.pattern,l.redirect));if(!l.fallback&&a&&(!l.exact||l.exact&&a.exact)?(r.onParams(l.params=a.params),l.show()):l.hide(),await tick(),!l.fallback&&a&&(l.childs.size>0&&0==l.activeChilds.size||0==l.childs.size&&l.fallbacks.size>0)){let t=l;for(;0==t.fallbacks.size;)if(t=t.parent,!t)return;t&&t.fallbacks.forEach(t=>t.show());}}};return l.makePattern(r.path),setContext("tinro",l),onMount(()=>l.register()),l.un=h.subscribe(t=>{l.match(t.path);}),l}function c(t,e=!1){return (t=t.slice(t.startsWith("/#")?2:0,t.endsWith("/*")?-2:void 0)).startsWith("/")||(t="/"+t),"/"===t&&(t=""),e&&!t.endsWith("/")&&(t+="/"),t}function s(t,e){t=c(t,!0),e=c(e,!0);const a=[];let n={},r=!0,i=t.split("/").map(t=>t.startsWith(":")?(a.push(t.slice(1)),"([^\\/]+)"):t).join("\\/"),s=e.match(new RegExp(`^${i}$`));return s||(r=!1,s=e.match(new RegExp("^"+i))),s?(a.forEach((t,e)=>n[t]=s[e+1]),{exact:r,params:n}):null}function o(t,e,a,n){const r=[e,"data-"+e].reduce((e,n)=>{const r=t.getAttribute(n);return a&&t.removeAttribute(n),null===r?e:r},!1);return !n&&""===r||(r||(n||!1))}function l(t){const e=t.split("&").map(t=>t.split("=")).reduce((t,e)=>{const a=e[0];if(!a)return t;let n=!(e.length>1)||e[e.length-1];return "string"==typeof n&&n.includes(",")&&(n=n.split(",")),void 0===t[a]?t[a]=[n]:t[a].push(n),t},{});return Object.entries(e).reduce((t,e)=>(t[e[0]]=e[1].length>1?e[1]:e[1][0],t),{})}const h=function(){let t="srcdoc"===window.location.pathname;const e=(e,a)=>{t?window.location.hash=e:history.pushState({},"",e),a(p(t));},{subscribe:a,set:n}=writable(p(t),a=>{window.hashchange=window.onpopstate=e=>n(p(t));const r=function(t){const e=e=>{const a=e.target.closest("a[href]");if(!(a&&o(a,"tinro-ignore"))&&a){const n=a.getAttribute("href").replace(/^\/#/,"");/^\/\/|^[a-zA-Z]+:/.test(n)||(e.preventDefault(),t(n.startsWith("/")?n:a.href.replace(window.location.origin,"")));}};return addEventListener("click",e),()=>removeEventListener("click",e)}(t=>e(t,n));return t=>{window.hashchange=window.onpopstate=null,r();}});return {subscribe:a,goto:t=>e(t,n),params:d,useHashNavigation:e=>n(p(t=void 0===e||e))}}();function p(t){return t?function(){const t=String(window.location.hash.slice(1)||"/").match(/^([^?#]+)(?:\?([^#]+))?(?:\#(.+))?$/);return {path:t[1]||"",query:l(t[2]||""),hash:t[3]||""}}():{path:window.location.pathname,query:l(window.location.search.slice(1)),hash:window.location.hash.slice(1)}}function d(){return getContext("tinro").params}

    /* node_modules/tinro/cmp/Route.svelte generated by Svelte v3.31.0 */
    const get_default_slot_changes = dirty => ({ params: dirty & /*params*/ 2 });
    const get_default_slot_context = ctx => ({ params: /*params*/ ctx[1] });

    // (21:0) {#if showContent}
    function create_if_block(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[6].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope, params*/ 34) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[5], dirty, get_default_slot_changes, get_default_slot_context);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(21:0) {#if showContent}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*showContent*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showContent*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showContent*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Route", slots, ['default']);
    	let { path = "/*" } = $$props;
    	let { fallback = false } = $$props;
    	let { redirect = false } = $$props;
    	let showContent = false;
    	let params = {};

    	i({
    		path,
    		fallback,
    		redirect,
    		onShow() {
    			$$invalidate(0, showContent = true);
    		},
    		onHide() {
    			$$invalidate(0, showContent = false);
    		},
    		onParams(newparams) {
    			$$invalidate(1, params = newparams);
    		}
    	});

    	const writable_props = ["path", "fallback", "redirect"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Route> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("path" in $$props) $$invalidate(2, path = $$props.path);
    		if ("fallback" in $$props) $$invalidate(3, fallback = $$props.fallback);
    		if ("redirect" in $$props) $$invalidate(4, redirect = $$props.redirect);
    		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createRouteObject: i,
    		path,
    		fallback,
    		redirect,
    		showContent,
    		params
    	});

    	$$self.$inject_state = $$props => {
    		if ("path" in $$props) $$invalidate(2, path = $$props.path);
    		if ("fallback" in $$props) $$invalidate(3, fallback = $$props.fallback);
    		if ("redirect" in $$props) $$invalidate(4, redirect = $$props.redirect);
    		if ("showContent" in $$props) $$invalidate(0, showContent = $$props.showContent);
    		if ("params" in $$props) $$invalidate(1, params = $$props.params);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [showContent, params, path, fallback, redirect, $$scope, slots];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { path: 2, fallback: 3, redirect: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fallback() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fallback(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get redirect() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set redirect(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /** @license ISC License (c) copyright 2017 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    var fulfills =
      function (algs) { return function (test) { return algs.indexOf(test) !== -1; }; };

    var _implements = fulfills;

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    function isArray(x) {
      return Array.isArray(x)
    }

    var isArray_1 = isArray;

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // isFunction : a -> Boolean
    function isFunction(fn) {
      return typeof fn === 'function'
    }

    var isFunction_1 = isFunction;

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    var toString = Object.prototype.toString;

    // isObject : a -> Boolean
    function isObject(x) {
      return !!x
        && toString.call(x) === '[object Object]'
    }

    var isObject_1 = isObject;

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // isString : a -> Boolean
    function isString(x) {
      return typeof x === 'string'
    }

    var isString_1 = isString;

    /** @license ISC License (c) copyright 2018 original and current authors */
    /** @author Robert Pearce (rpearce) */

    // isSymbol : a -> Boolean
    function isSymbol(x) {
      return typeof x === 'symbol'
    }

    var isSymbol_1 = isSymbol;

    /** @license ISC License (c) copyright 2018 original and current authors */
    /** @author Dale Francis (dalefrancis88) */

    // isDate : a -> Boolean
    function isDate(x) {
      return Object.prototype.toString.apply(x) === '[object Date]'
        && !isNaN(x.valueOf())
    }

    var isDate_1 = isDate;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */








    function arrayInspect(xs) {
      return xs.length
        ? xs.map(inspect).reduce(function (a, x) { return a + ',' + x; })
        : xs
    }

    // inspect : a -> String
    function inspect(x) {
      if(x && isFunction_1(x.inspect)) {
        return (" " + (x.inspect()))
      }

      if(isFunction_1(x)) {
        return ' Function'
      }

      if(isArray_1(x)) {
        return (" [" + (arrayInspect(x)) + " ]")
      }

      if(isObject_1(x)) {
        return (" { " + (Object.keys(x).reduce(function (acc, key) {
          return acc.concat([ (key + ":" + (inspect(x[key]))) ])
        }, []).join(', ')) + " }")
      }

      if(isString_1(x)) {
        return (" \"" + x + "\"")
      }

      if(isSymbol_1(x) || isDate_1(x)) {
        return (" " + (x.toString()))
      }

      return (" " + x)
    }

    var inspect_1 = inspect;

    /** @license ISC License (c) copyright 2017 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    var _types = {
      'unk': function () { return 'unknown'; },
      'All': function () { return 'All'; },
      'Any': function () { return 'Any'; },
      'Arrow': function () { return 'Arrow'; },
      'Assign': function () { return 'Assign'; },
      'Async': function () { return 'Async'; },
      'Const': function (inner) { return ("Const(" + inner + ")"); },
      'Either': function () { return 'Either'; },
      'Endo': function () { return 'Endo'; },
      'Equiv': function () { return 'Equiv'; },
      'First': function () { return 'First'; },
      'Identity': function () { return 'Identity'; },
      'IO': function () { return 'IO'; },
      'Last': function () { return 'Last'; },
      'List': function () { return 'List'; },
      'Max': function () { return 'Max'; },
      'Maybe': function () { return 'Maybe'; },
      'Min': function () { return 'Min'; },
      'Pair': function () { return 'Pair'; },
      'Pred': function () { return 'Pred'; },
      'Prod': function () { return 'Prod'; },
      'Reader': function () { return 'Reader'; },
      'Result': function () { return 'Result'; },
      'Star': function () { return 'Star'; },
      'State': function () { return 'State'; },
      'Sum': function () { return 'Sum'; },
      'Tuple': function (n) { return (n + "-Tuple"); },
      'Unit': function () { return 'Unit'; },
      'Writer': function () { return 'Writer'; }
    };

    var type =
      function (type) { return _types[type] || _types['unk']; };

    var proxy =
      function (t, ctx) { return ({ type: function () { return type(t)(ctx); } }); };

    var typeFn = function (t, ver, ctx) {
      var typeStr = type(t)(ctx);
      return ("crocks/" + typeStr + "@" + (ver || 0))
    };

    var types = {
      proxy: proxy, type: type, typeFn: typeFn
    };

    /** @license ISC License (c) copyright 2018 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    var flNames = {
      alt: 'fantasy-land/alt',
      bimap: 'fantasy-land/bimap',
      chain: 'fantasy-land/chain',
      compose: 'fantasy-land/compose',
      concat: 'fantasy-land/concat',
      contramap: 'fantasy-land/contramap',
      empty: 'fantasy-land/empty',
      equals: 'fantasy-land/equals',
      extend: 'fantasy-land/extend',
      filter: 'fantasy-land/filter',
      id: 'fantasy-land/id',
      map: 'fantasy-land/map',
      of: 'fantasy-land/of',
      promap: 'fantasy-land/promap',
      reduce: 'fantasy-land/reduce',
      zero: 'fantasy-land/zero'
    };

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    var check = function (alg, m) { return isFunction_1(m[flNames[alg]]) || isFunction_1(m[alg]); };

    var checkImpl = function (alg, m) { return isFunction_1(m['@@implements']) && !!m['@@implements'](alg); };

    var hasAlg = function (alg, m) { return !!m && (check(alg, m) || checkImpl(alg, m)); };

    var hasAlg_1 = hasAlg;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    // isFunctor : a -> Boolean
    function isFunctor(m) {
      return !!m && hasAlg_1('map', m)
    }

    var isFunctor_1 = isFunctor;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    // isApply : a -> Boolean
    function isApply(m) {
      return isFunctor_1(m)
        && hasAlg_1('ap', m)
    }

    var isApply_1 = isApply;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    // isSemigroup : a -> Boolean
    function isSemigroup(m) {
      return isString_1(m)
        || !!m && hasAlg_1('concat', m)
    }

    var isSemigroup_1 = isSemigroup;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    // isMonoid :: a -> Boolean
    function isMonoid(m) {
      return isSemigroup_1(m)
        && (hasAlg_1('empty', m) || hasAlg_1('empty', m.constructor))
    }

    var isMonoid_1 = isMonoid;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    var CURRY_SYMB =
      '@@crocks/curried';

    function applyCurry(fn, arg) {
      if(!isFunction_1(fn)) { return fn }

      return fn.length > 1 ? fn.bind(null, arg) : fn.call(null, arg)
    }

    // curry : ((a, b, c) -> d) -> a -> b -> c -> d
    function curry(fn) {
      if(fn[CURRY_SYMB]) {
        return fn
      }

      function curried() {
        var xs = [], len = arguments.length;
        while ( len-- ) xs[ len ] = arguments[ len ];

        var args =
          xs.length ? xs : [ undefined ];

        if(args.length < fn.length) {
          return curry(Function.bind.apply(fn, [ null ].concat(args)))
        }

        var val = args.length === fn.length
          ? fn.apply(null, args)
          : args.reduce(applyCurry, fn);

        if(isFunction_1(val)) {
          return curry(val)
        }

        return val
      }

      Object.defineProperty(curried, CURRY_SYMB, {
        enumerable: false,
        writable: false,
        value: true
      });

      return curried
    }

    var curry_1 = curry;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    function type$1(x) {
      if(x) {
        if(isFunction_1(x.type)) {
          return x.type()
        }
      }
      return {}.toString.call(x).slice(8, -1)
    }

    var type_1 = type$1;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */





    // isSameType :: Container m => (m, m) -> Boolean
    function isSameType(x, y) {
      var tX = type_1(x);
      var tY = type_1(y);

      return tX === tY
        || isFunction_1(x) && x.name === tY
        || isFunction_1(y) && y.name === tX
    }

    var isSameType_1 = curry_1(isSameType);

    /** @license ISC License (c) copyright 2017 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // isSame : (a, b) -> Boolean
    function isSame(x, y) {
      if(x === y) {
        return x !== 0 || 1 / x === 1 / y
      }

      return x !== x && y !== y
    }

    var isSame_1 = isSame;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */







    var comp = function (a, b) { return a.valueOf() === b.valueOf(); };

    var strats = {
      'Array': function (a, b) { return a.length === b.length
          && deepEquals(a, b); },

      'Date': function (a, b) { return isSame_1(a.valueOf(), b.valueOf()); },

      'Error': function (a, b) { return a.name === b.name
          && a.message === b.message; },

      'Object': function (a, b) { return Object.keys(a).length === Object.keys(b).length
          && deepEquals(a, b); },

      'RegExp': function (a, b) { return a.source === b.source
          && a.ignoreCase === b.ignoreCase
          && a.global === b.global
          && a.multiline === b.multiline
          && a.unicode === b.unicode; }
    };

    function deepEquals(a, b) {
      for(var key in a) {
        if(!equals(a[key], b[key])) {
          return false
        }
      }
      return true
    }

    function equals(a, b) {
      if(isSame_1(a, b)) {
        return true
      }

      if(!isSameType_1(a, b)) {
        return false
      }

      if(hasAlg_1('equals', a)) {
        return (b[flNames.equals] || b.equals).call(b, a)
      }

      return (strats[type_1(a)] || comp)(a, b)
    }

    var equals_1 = equals;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */





    function isEmpty(x) {
      if(isMonoid_1(x)) {
        var empty = x.constructor[flNames['empty']] || x.constructor['empty'] || x['empty'];

        return equals_1(x, empty())
      }

      if(isObject_1(x)) {
        return !Object.keys(x).length
      }

      if(x && x.length !== undefined) {
        return !x.length
      }

      return true
    }

    var isEmpty_1 = isEmpty;

    /** @license ISC License (c) copyright 2016 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    // isApplicative : a -> Boolean
    function isApplicative(m) {
      return isApply_1(m)
        && (hasAlg_1('of', m) || hasAlg_1('of', m.constructor))
    }

    var isApplicative_1 = isApplicative;

    /** @license ISC License (c) copyright 2018 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    var isTypeRepOf = function (x, y) { return isFunction_1(y)
        && (x === y || x.name === y.name); };

    var isTypeRepOf_1 = isTypeRepOf;

    /** @license ISC License (c) copyright 2018 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */




    var apOrFunc = function (af) { return function (x) { return isApplicative_1(af)
        ? af.of(x)
        : isTypeRepOf_1(Array, af) ? [ x ] : af(x); }; };

    var apOrFunc_1 = apOrFunc;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */









    var identity =
      function (x) { return x; };

    var concat =
      function (x) { return function (m) { return x.concat(m); }; };

    function runTraverse(name, fn) {
      return function(acc, x) {
        var m = fn(x);

        if(!((isApply_1(acc) || isArray_1(acc)) && isSameType_1(acc, m))) {
          throw new TypeError(("Array." + name + ": Must wrap Applys of the same type"))
        }

        if(isArray_1(m)) {
          return ap(acc, map(function (v) { return concat([ v ]); }, m))
        }

        return m
          .map(function (v) { return concat([ v ]); })
          .ap(acc)
      }
    }

    var allFuncs =
      function (xs) { return xs.reduce(function (b, i) { return b && isFunction_1(i); }, true); };

    var map =
      function (f, m) { return m.map(function (x) { return f(x); }); };

    function ap(x, m) {
      if(!(m.length && allFuncs(m))) {
        throw new TypeError('Array.ap: Second Array must all be functions')
      }

      return m.reduce(function (acc, f) { return acc.concat(map(f, x)); }, [])
    }

    function chain(f, m) {
      return m.reduce(function(y, x) {
        var n = f(x);

        if(!isArray_1(n)) {
          throw new TypeError('Array.chain: Function must return an Array')
        }

        return y.concat(n)
      }, [])
    }

    function sequence(f, m) {
      var fn = apOrFunc_1(f);
      return m.reduceRight(runTraverse('sequence', identity), fn([]))
    }

    function traverse(f, fn, m) {
      var af = apOrFunc_1(f);
      return m.reduceRight(runTraverse('traverse', fn), af([]))
    }

    function fold(m) {
      if(isEmpty_1(m)) {
        throw new TypeError(
          'Array.fold: Non-empty Array of Semigroups required'
        )
      }

      var head =
        m[0];

      if(!isSemigroup_1(head)) {
        throw new TypeError('Array.fold: Must contain Semigroups of the same type')
      }

      return  m.reduce(function(x, y) {
        if(!isSameType_1(x, y)) {
          throw new TypeError('Array.fold: Must contain Semigroups of the same type')
        }
        return x.concat(y)
      })
    }

    function foldMap(fn, m) {
      if(isEmpty_1(m)) {
        throw new TypeError(
          'Array.foldMap: Non-empty Array required'
        )
      }

      var head =
        fn(m[0]);

      if(!isSemigroup_1(head)) {
        throw new TypeError(
          'Array.foldMap: Provided function must return Semigroups of the same type'
        )
      }

      return m.length === 1
        ? head
        : m.slice(1).reduce(function(semi, x) {
          var val = fn(x);

          if(!(isSameType_1(semi, val) && isSemigroup_1(val))) {
            throw new TypeError(
              'Array.foldMap: Provided function must return Semigroups of the same type'
            )
          }

          return semi.concat(val)
        }, head)
    }

    function set(indx, val, m) {
      var arr = m.slice();

      arr[indx] = val;

      return arr
    }

    function unset(indx, m) {
      return m.slice(0, indx)
        .concat(m.slice(indx + 1))
    }

    var array = {
      ap: ap, chain: chain, fold: fold,
      foldMap: foldMap, map: map,
      sequence: sequence, set: set,
      traverse: traverse, unset: unset
    };

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // Composition (Bluebird)
    // compose : (b -> c) -> (a -> b) -> a -> c
    function compose(f, g) {
      return function(x) {
        return f(g(x))
      }
    }

    var compose_1 = compose;

    /** @license ISC License (c) copyright 2017 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // once : ((*) -> b) -> ((*) -> b)
    function once(fn) {
      var called, result;

      return function() {
        if(!called) {
          called = true;
          result = fn.apply(null, arguments);
        }

        return result
      }
    }

    var once_1 = once;

    /** @license ISC License (c) copyright 2017 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    var _unit =
      Function.prototype;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    // isFoldable : a -> Boolean
    function isFoldable(m) {
      return !!m
        && hasAlg_1('reduce', m)
    }

    var isFoldable_1 = isFoldable;

    /** @license ISC License (c) copyright 2016 original and current authors */
    /** @author Ian Hofmann-Hicks (evil) */

    // isNumber : a -> Boolean
    function isNumber(x) {
      return typeof x === 'number'
        && !isNaN(x)
    }

    var isNumber_1 = isNumber;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    // isInteger : a -> Boolean
    function isInteger(x) {
      return isNumber_1(x)
        && isFinite(x)
        && Math.floor(x) === x
    }

    var isInteger_1 = isInteger;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */



    // isPromise : a -> Boolean
    function isPromise(p) {
      return !!p
        && isFunction_1(p.then)
        && isFunction_1(p.catch)
    }

    var isPromise_1 = isPromise;

    /** @license ISC License (c) copyright 2017 original and current authors */

    /** @author Ian Hofmann-Hicks (evil) */

    var VERSION = 5;



    var type$2 = types.type('Async');
    var _type = types.typeFn(type$2(), VERSION);














    var allAsyncs = function (xs) { return xs.reduce(function (acc, x) { return acc && isSameType_1(Async, x); }, true); };

    var _of =
      function (x) { return Async(function (_, resolve) { return resolve(x); }); };

    var Rejected =
      function (x) { return Async(function (reject) { return reject(x); }); };

    function all(asyncs) {
      if(!(isFoldable_1(asyncs) && allAsyncs(asyncs))) {
        throw new TypeError('Async.all: Foldable structure of Asyncs required')
      }

      if(isArray_1(asyncs)) {
        return array.sequence(Async.of, asyncs)
      }

      return asyncs.sequence(Async.of)
    }

    function fromNode(fn, ctx) {
      if(!isFunction_1(fn)) {
        throw new TypeError('Async.fromNode: CPS function required')
      }

      return function () {
          var args = [], len = arguments.length;
          while ( len-- ) args[ len ] = arguments[ len ];

          return Async(function (reject, resolve) {
          fn.apply(ctx,
            args.concat(
              function (err, data) { return err ? reject(err) : resolve(data); }
            )
          );
        });
      }
    }

    function fromPromise(fn) {
      if(!isFunction_1(fn)) {
        throw new TypeError('Async.fromPromise: Promise returning function required')
      }

      return function() {
        var promiseArgs = arguments;

        return Async(function(reject, resolve) {
          var promise = fn.apply(null, promiseArgs);

          if(!isPromise_1(promise)) {
            throw new TypeError('Async.fromPromise: Promise returning function required')
          }

          promise
            .then(resolve, reject);
        })
      }
    }

    function rejectAfter(ms, value) {
      if(!(isInteger_1(ms) && ms >= 0)) {
        throw new TypeError(
          'Async.rejectAfter: Positive Integer required for first argument'
        )
      }

      return Async(function (rej) {
        var token = setTimeout(function () {
          rej(value);
        }, ms);

        return function () { clearTimeout(token); }
      })
    }

    function resolveAfter(ms, value) {
      if(!(isInteger_1(ms) && ms >= 0)) {
        throw new TypeError(
          'Async.resolveAfter: Positive Integer required for first argument'
        )
      }

      return Async(function (_, res) {
        var token = setTimeout(function () {
          res(value);
        }, ms);

        return function () { clearTimeout(token); }
      })
    }

    function Async(fn) {
      var obj;

      if(!isFunction_1(fn)) {
        throw new TypeError('Async: Function required')
      }

      var of =
        _of;

      var inspect =
        function () { return ("Async" + (inspect_1(fn))); };

      function fork(reject, resolve, cleanup) {
        if(!isFunction_1(reject) || !isFunction_1(resolve)) {
          throw new TypeError('Async.fork: Reject and resolve functions required')
        }

        var cancelled = false;
        var settled = false;

        var cancel =
          function () { cancelled = true; };

        var forkCancel =
          isFunction_1(cleanup) ? cleanup : _unit;

        var settle = function (f, x) {
          if(!settled) {
            settled = true;

            if(cancelled) {
              return _unit()
            }

            return f(x)
          }
        };

        var internal = fn(
          settle.bind(null, reject),
          settle.bind(null, resolve)
        );

        var internalFn = isFunction_1(internal) ? internal : _unit;

        return once_1(function () { return forkCancel(cancel(internalFn())); })
      }

      function toPromise() {
        return new Promise(function(resolve, reject) {
          fork(reject, resolve);
        })
      }

      function race(m) {
        if(!isSameType_1(Async, m)) {
          throw new TypeError('Async.race: Async required')
        }

        return Async(function(reject, resolve) {
          var settle = once_1(
            function (resolved, value) { return resolved ? resolve(value) : reject(value); }
          );

          var res = settle.bind(null, true);
          var rej = settle.bind(null, false);

          var cancelOne = fork(rej, res);
          var cancelTwo = m.fork(rej, res);

          return function () { cancelOne(); cancelTwo(); }
        })
      }

      function swap(l, r) {
        if(!isFunction_1(l) || !isFunction_1(r)) {
          throw new TypeError('Async.swap: Functions required for both arguments')
        }

        return Async(function(reject, resolve) {
          return fork(
            compose_1(resolve, l),
            compose_1(reject, r)
          )
        })
      }

      function coalesce(l, r) {
        if(!isFunction_1(l) || !isFunction_1(r)) {
          throw new TypeError('Async.coalesce: Functions required for both arguments')
        }

        return Async(function(reject, resolve) {
          return fork(
            compose_1(resolve, l),
            compose_1(resolve, r)
          )
        })
      }

      function map(method) {
        return function(mapFn) {
          if(!isFunction_1(mapFn)) {
            throw new TypeError(("Async." + method + ": Function required"))
          }

          return Async(function(reject, resolve) {
            return fork(reject, compose_1(resolve, mapFn))
          })
        }
      }

      function bimap(method) {
        return function(l, r) {
          if(!isFunction_1(l) || !isFunction_1(r)) {
            throw new TypeError(("Async." + method + ": Functions required for both arguments"))
          }

          return Async(function(reject, resolve) {
            return fork(
              compose_1(reject, l),
              compose_1(resolve, r)
            )
          })
        }
      }

      function alt(method) {
        return function(m) {
          if(!isSameType_1(Async, m)) {
            throw new TypeError(("Async." + method + ": Async required"))
          }

          return Async(function (rej, res) {
            var cancel = _unit;
            var innerCancel = _unit;
            cancel = fork(
              function () { innerCancel = m.fork(rej, res); },
              res
            );
            return once_1(function () { return innerCancel(cancel()); })
          })
        }
      }

      function ap(m) {
        if(!isSameType_1(Async, m)) {
          throw new TypeError('Async.ap: Async required')
        }

        return Async(function(reject, resolve) {
          var apFn = null;
          var value = null;
          var fnDone = false;
          var valueDone = false;
          var cancelled = false;

          var cancel = function () { cancelled = true; };
          var rejectOnce = once_1(reject);

          function resolveBoth() {
            if(!cancelled && fnDone && valueDone) {
              compose_1(resolve, apFn)(value);
            }
          }

          var fnCancel = fork(rejectOnce, function(f) {
            if(!isFunction_1(f)) {
              throw new TypeError('Async.ap: Wrapped value must be a function')
            }

            fnDone = true;
            apFn = f;
            resolveBoth();
          });

          var valueCancel = m.fork(rejectOnce, function (x) {
            valueDone = true;
            value = x;
            resolveBoth();
          });

          return function () { fnCancel(); valueCancel(); cancel(); }
        })
      }

      function chain(method) {
        return function(mapFn) {
          if(!isFunction_1(mapFn)) {
            throw new TypeError(
              ("Async." + method + ": Async returning function required")
            )
          }

          return Async(function(reject, resolve) {
            var cancel = _unit;
            var innerCancel = _unit;
            cancel = fork(reject, function(x) {
              var m = mapFn(x);

              if(!isSameType_1(Async, m)) {
                throw new TypeError(
                  ("Async." + method + ": Function must return another Async")
                )
              }

              innerCancel = m.fork(reject, resolve);
            });
            return once_1(function () { return innerCancel(cancel()); })
          })
        }
      }

      function bichain(l, r) {
        var bichainErr = 'Async.bichain: Both arguments must be Async returning functions';

        if(!isFunction_1(l) || !isFunction_1(r)) {
          throw new TypeError(bichainErr)
        }

        return Async(function(rej, res) {
          var cancel = _unit;
          var innerCancel = _unit;

          function setInnerCancel(mapFn) {
            return function(x) {
              var m = mapFn(x);

              if(!isSameType_1(Async, m)) {
                throw new TypeError(bichainErr)
              }

              innerCancel = m.fork(rej, res);
            }
          }

          cancel = fork(setInnerCancel(l), setInnerCancel(r));

          return once_1(function () { return innerCancel(cancel()); })
        })
      }

      return ( obj = {
        fork: fork, toPromise: toPromise, inspect: inspect,
        toString: inspect, type: type$2,
        swap: swap, race: race, coalesce: coalesce, ap: ap,
        of: of,
        alt: alt('alt'),
        bimap: bimap('bimap'),
        map: map('map'),
        chain: chain('chain'),
        bichain: bichain
      }, obj[flNames.of] = of, obj[flNames.alt] = alt(flNames.alt), obj[flNames.bimap] = bimap(flNames.bimap), obj[flNames.map] = map(flNames.map), obj[flNames.chain] = chain(flNames.chain), obj['@@type'] = _type, obj.constructor = Async, obj )
    }

    Async.of = _of;
    Async.type = type$2;

    Async[flNames.of] = _of;
    Async['@@type'] = _type;

    Async.Rejected = Rejected;
    Async.Resolved = _of;

    Async.fromPromise = fromPromise;
    Async.fromNode = fromNode;

    Async.all = all;
    Async.rejectAfter = rejectAfter;
    Async.resolveAfter = resolveAfter;

    Async['@@implements'] = _implements(
      [ 'alt', 'ap', 'bimap', 'chain', 'map', 'of' ]
    );

    var Async_1 = Async;

    const url = 'https://hyper63-minisearch.onrender.com';

    const asyncFetch = Async_1.fromPromise(fetch);
    const toJSON = res => Async_1.fromPromise(res.json.bind(res))();


    const index = (name) => asyncFetch(`${url}/search/${name}`, { 
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: ["Title", "Blob"],
        storeFields: ["Title", "Blob", "Attributes"]
      })
    }).chain(toJSON)
      .toPromise();

    const add = ({index, id, Title, Blob, Attributes}) => asyncFetch(`${url}/search/${index}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: id,
        doc: { id, Title, Blob, Attributes }
      })
    }).chain(toJSON)
      .toPromise();

    const search = (index, txt) => asyncFetch(`${url}/search/${index}/_query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: txt
      })
    }).chain(toJSON)
      .toPromise();

    /* src/Index.svelte generated by Svelte v3.31.0 */
    const file = "src/Index.svelte";

    function create_fragment$1(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t5;
    	let form;
    	let div0;
    	let label;
    	let t7;
    	let input;
    	let t8;
    	let div1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Create Search Index Store";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "A search index store is like a database of search documents, this collection of search documents provides a way to specify a specific search you would like to perform.";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "Complete the form to create a search index";
    			t5 = space();
    			form = element("form");
    			div0 = element("div");
    			label = element("label");
    			label.textContent = "Index Name";
    			t7 = space();
    			input = element("input");
    			t8 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "Create Index";
    			add_location(h1, file, 15, 2, 265);
    			add_location(p0, file, 16, 2, 302);
    			add_location(p1, file, 17, 2, 479);
    			attr_dev(label, "for", "name");
    			add_location(label, file, 20, 6, 594);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", "name");
    			add_location(input, file, 21, 6, 637);
    			add_location(div0, file, 19, 4, 582);
    			attr_dev(button, "type", "submit");
    			add_location(button, file, 24, 6, 712);
    			add_location(div1, file, 23, 4, 700);
    			add_location(form, file, 18, 2, 531);
    			add_location(main, file, 14, 0, 256);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, p1);
    			append_dev(main, t5);
    			append_dev(main, form);
    			append_dev(form, div0);
    			append_dev(div0, label);
    			append_dev(div0, t7);
    			append_dev(div0, input);
    			set_input_value(input, /*name*/ ctx[0]);
    			append_dev(form, t8);
    			append_dev(form, div1);
    			append_dev(div1, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[1]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1 && input.value !== /*name*/ ctx[0]) {
    				set_input_value(input, /*name*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Index", slots, []);
    	let name = "";

    	async function handleSubmit() {
    		const result = await index(name);

    		if (result.ok) {
    			// navigate to home
    			h.goto("/");
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Index> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	$$self.$capture_state = () => ({ index, router: h, name, handleSubmit });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, handleSubmit, input_input_handler];
    }

    class Index extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Index",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/Form.svelte generated by Svelte v3.31.0 */
    const file$1 = "src/Form.svelte";

    function create_fragment$2(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t5;
    	let form;
    	let div0;
    	let label0;
    	let t7;
    	let input0;
    	let t8;
    	let div1;
    	let label1;
    	let t10;
    	let input1;
    	let t11;
    	let div2;
    	let label2;
    	let t13;
    	let textarea;
    	let t14;
    	let div3;
    	let label3;
    	let t16;
    	let input2;
    	let t17;
    	let div4;
    	let button;
    	let t19;
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Create Search Document";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "This form creates a search document that can be used in the hyper63 search";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "Complete the form to create a document to index";
    			t5 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Index";
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Title";
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Content";
    			t13 = space();
    			textarea = element("textarea");
    			t14 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Bookmark";
    			t16 = space();
    			input2 = element("input");
    			t17 = space();
    			div4 = element("div");
    			button = element("button");
    			button.textContent = "Submit";
    			t19 = space();
    			a = element("a");
    			a.textContent = "Cancel and Close";
    			add_location(h1, file$1, 30, 2, 427);
    			add_location(p0, file$1, 31, 2, 461);
    			add_location(p1, file$1, 32, 2, 545);
    			attr_dev(label0, "for", "index");
    			add_location(label0, file$1, 35, 6, 665);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "index");
    			add_location(input0, file$1, 36, 6, 704);
    			add_location(div0, file$1, 34, 4, 653);
    			attr_dev(label1, "for", "title");
    			add_location(label1, file$1, 39, 6, 781);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "title");
    			add_location(input1, file$1, 40, 6, 820);
    			add_location(div1, file$1, 38, 4, 769);
    			attr_dev(label2, "for", "content");
    			add_location(label2, file$1, 43, 6, 897);
    			attr_dev(textarea, "id", "content");
    			add_location(textarea, file$1, 44, 6, 940);
    			add_location(div2, file$1, 42, 4, 885);
    			attr_dev(label3, "for", "url");
    			add_location(label3, file$1, 47, 6, 1020);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "id", "url");
    			add_location(input2, file$1, 48, 6, 1060);
    			add_location(div3, file$1, 46, 4, 1008);
    			attr_dev(button, "type", "submit");
    			add_location(button, file$1, 51, 6, 1133);
    			attr_dev(a, "href", "/");
    			add_location(a, file$1, 52, 6, 1177);
    			add_location(div4, file$1, 50, 4, 1121);
    			add_location(form, file$1, 33, 2, 602);
    			add_location(main, file$1, 29, 0, 418);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, p1);
    			append_dev(main, t5);
    			append_dev(main, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t7);
    			append_dev(div0, input0);
    			set_input_value(input0, /*index*/ ctx[0]);
    			append_dev(form, t8);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t10);
    			append_dev(div1, input1);
    			set_input_value(input1, /*Title*/ ctx[1]);
    			append_dev(form, t11);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t13);
    			append_dev(div2, textarea);
    			set_input_value(textarea, /*Blob*/ ctx[2]);
    			append_dev(form, t14);
    			append_dev(form, div3);
    			append_dev(div3, label3);
    			append_dev(div3, t16);
    			append_dev(div3, input2);
    			set_input_value(input2, /*url*/ ctx[3]);
    			append_dev(form, t17);
    			append_dev(form, div4);
    			append_dev(div4, button);
    			append_dev(div4, t19);
    			append_dev(div4, a);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[7]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[4]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*index*/ 1 && input0.value !== /*index*/ ctx[0]) {
    				set_input_value(input0, /*index*/ ctx[0]);
    			}

    			if (dirty & /*Title*/ 2 && input1.value !== /*Title*/ ctx[1]) {
    				set_input_value(input1, /*Title*/ ctx[1]);
    			}

    			if (dirty & /*Blob*/ 4) {
    				set_input_value(textarea, /*Blob*/ ctx[2]);
    			}

    			if (dirty & /*url*/ 8 && input2.value !== /*url*/ ctx[3]) {
    				set_input_value(input2, /*url*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Form", slots, []);
    	let index = "";
    	let Title = "";
    	let Blob = "";
    	let url = "";

    	async function handleSubmit() {
    		const result = await add({
    			index,
    			id: new Date().toISOString(),
    			Title,
    			Blob,
    			Attributes: { _source_uri: url }
    		});

    		// reset form
    		if (result.ok) {
    			$$invalidate(1, Title = "");
    			$$invalidate(2, Blob = "");
    			$$invalidate(3, url = "");
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		index = this.value;
    		$$invalidate(0, index);
    	}

    	function input1_input_handler() {
    		Title = this.value;
    		$$invalidate(1, Title);
    	}

    	function textarea_input_handler() {
    		Blob = this.value;
    		$$invalidate(2, Blob);
    	}

    	function input2_input_handler() {
    		url = this.value;
    		$$invalidate(3, url);
    	}

    	$$self.$capture_state = () => ({
    		add,
    		index,
    		Title,
    		Blob,
    		url,
    		handleSubmit
    	});

    	$$self.$inject_state = $$props => {
    		if ("index" in $$props) $$invalidate(0, index = $$props.index);
    		if ("Title" in $$props) $$invalidate(1, Title = $$props.Title);
    		if ("Blob" in $$props) $$invalidate(2, Blob = $$props.Blob);
    		if ("url" in $$props) $$invalidate(3, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		index,
    		Title,
    		Blob,
    		url,
    		handleSubmit,
    		input0_input_handler,
    		input1_input_handler,
    		textarea_input_handler,
    		input2_input_handler
    	];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/Search.svelte generated by Svelte v3.31.0 */

    const { console: console_1 } = globals;
    const file$2 = "src/Search.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (34:2) {#if matches}
    function create_if_block$1(ctx) {
    	let h3;
    	let t1;
    	let each_1_anchor;
    	let each_value = /*matches*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Search Results";
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			add_location(h3, file$2, 34, 4, 849);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*JSON, matches*/ 4) {
    				each_value = /*matches*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(34:2) {#if matches}",
    		ctx
    	});

    	return block;
    }

    // (36:4) {#each matches as match}
    function create_each_block(ctx) {
    	let article;
    	let header;
    	let h1;
    	let t0_value = /*match*/ ctx[6].Title + "";
    	let t0;
    	let t1;
    	let div0;
    	let t2_value = /*match*/ ctx[6].Blob + "";
    	let t2;
    	let t3;
    	let div1;
    	let h4;
    	let t5;
    	let pre;
    	let code;
    	let t6_value = JSON.stringify(/*match*/ ctx[6], null, 2) + "";
    	let t6;
    	let t7;

    	const block = {
    		c: function create() {
    			article = element("article");
    			header = element("header");
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Search Info";
    			t5 = space();
    			pre = element("pre");
    			code = element("code");
    			t6 = text(t6_value);
    			t7 = space();
    			attr_dev(h1, "class", "svelte-6vi1xp");
    			add_location(h1, file$2, 38, 10, 945);
    			attr_dev(header, "class", "svelte-6vi1xp");
    			add_location(header, file$2, 37, 8, 926);
    			add_location(div0, file$2, 40, 8, 994);
    			add_location(h4, file$2, 44, 10, 1062);
    			add_location(code, file$2, 45, 15, 1098);
    			add_location(pre, file$2, 45, 10, 1093);
    			add_location(div1, file$2, 43, 8, 1046);
    			attr_dev(article, "class", "svelte-6vi1xp");
    			add_location(article, file$2, 36, 6, 908);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, header);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(article, t1);
    			append_dev(article, div0);
    			append_dev(div0, t2);
    			append_dev(article, t3);
    			append_dev(article, div1);
    			append_dev(div1, h4);
    			append_dev(div1, t5);
    			append_dev(div1, pre);
    			append_dev(pre, code);
    			append_dev(code, t6);
    			append_dev(article, t7);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*matches*/ 4 && t0_value !== (t0_value = /*match*/ ctx[6].Title + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*matches*/ 4 && t2_value !== (t2_value = /*match*/ ctx[6].Blob + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*matches*/ 4 && t6_value !== (t6_value = JSON.stringify(/*match*/ ctx[6], null, 2) + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(36:4) {#each matches as match}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t5;
    	let form;
    	let div0;
    	let label0;
    	let t7;
    	let input0;
    	let t8;
    	let div1;
    	let label1;
    	let t10;
    	let input1;
    	let t11;
    	let div2;
    	let button;
    	let t13;
    	let mounted;
    	let dispose;
    	let if_block = /*matches*/ ctx[2] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Search";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Perform a search using a search index you created and query text";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "Select a search index to query then ask the search index a question";
    			t5 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Index Name";
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Question";
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div2 = element("div");
    			button = element("button");
    			button.textContent = "Search";
    			t13 = space();
    			if (if_block) if_block.c();
    			attr_dev(h1, "class", "svelte-6vi1xp");
    			add_location(h1, file$2, 17, 2, 293);
    			add_location(p0, file$2, 18, 2, 311);
    			add_location(p1, file$2, 19, 2, 385);
    			attr_dev(label0, "for", "index");
    			add_location(label0, file$2, 22, 6, 521);
    			attr_dev(input0, "id", "index");
    			attr_dev(input0, "type", "text");
    			add_location(input0, file$2, 23, 6, 565);
    			add_location(div0, file$2, 21, 4, 509);
    			attr_dev(label1, "for", "question");
    			add_location(label1, file$2, 26, 6, 642);
    			attr_dev(input1, "id", "question");
    			attr_dev(input1, "type", "text");
    			add_location(input1, file$2, 27, 6, 687);
    			add_location(div1, file$2, 25, 4, 630);
    			attr_dev(button, "type", "submit");
    			add_location(button, file$2, 30, 6, 770);
    			add_location(div2, file$2, 29, 4, 758);
    			add_location(form, file$2, 20, 2, 462);
    			add_location(main, file$2, 16, 0, 284);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, p1);
    			append_dev(main, t5);
    			append_dev(main, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t7);
    			append_dev(div0, input0);
    			set_input_value(input0, /*index*/ ctx[0]);
    			append_dev(form, t8);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t10);
    			append_dev(div1, input1);
    			set_input_value(input1, /*question*/ ctx[1]);
    			append_dev(form, t11);
    			append_dev(form, div2);
    			append_dev(div2, button);
    			append_dev(main, t13);
    			if (if_block) if_block.m(main, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(form, "submit", prevent_default(/*doSearch*/ ctx[3]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*index*/ 1 && input0.value !== /*index*/ ctx[0]) {
    				set_input_value(input0, /*index*/ ctx[0]);
    			}

    			if (dirty & /*question*/ 2 && input1.value !== /*question*/ ctx[1]) {
    				set_input_value(input1, /*question*/ ctx[1]);
    			}

    			if (/*matches*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Search", slots, []);
    	let index = "";
    	let question = "";
    	let matches = [];

    	async function doSearch() {
    		const result = await search(index, question);
    		$$invalidate(0, index = "");
    		$$invalidate(1, question = "");
    		$$invalidate(2, matches = result.matches);
    		console.log(matches);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Search> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		index = this.value;
    		$$invalidate(0, index);
    	}

    	function input1_input_handler() {
    		question = this.value;
    		$$invalidate(1, question);
    	}

    	$$self.$capture_state = () => ({
    		search,
    		index,
    		question,
    		matches,
    		doSearch
    	});

    	$$self.$inject_state = $$props => {
    		if ("index" in $$props) $$invalidate(0, index = $$props.index);
    		if ("question" in $$props) $$invalidate(1, question = $$props.question);
    		if ("matches" in $$props) $$invalidate(2, matches = $$props.matches);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [index, question, matches, doSearch, input0_input_handler, input1_input_handler];
    }

    class Search extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.31.0 */
    const file$3 = "src/App.svelte";

    // (18:0) <Route path="/">
    function create_default_slot_3(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Search Demo";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "This is a simple demo of the hyper63 search module powered by mini-search";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "In this demo you can create a search index, create search documents, perform a search";
    			add_location(h1, file$3, 19, 2, 408);
    			add_location(p0, file$3, 20, 2, 431);
    			add_location(p1, file$3, 21, 2, 514);
    			add_location(main, file$3, 18, 2, 399);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, p0);
    			append_dev(main, t3);
    			append_dev(main, p1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(18:0) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (25:0) <Route path="/index">
    function create_default_slot_2(ctx) {
    	let index;
    	let current;
    	index = new Index({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(index.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(index, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(index.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(index.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(index, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(25:0) <Route path=\\\"/index\\\">",
    		ctx
    	});

    	return block;
    }

    // (28:0) <Route path="/new">
    function create_default_slot_1(ctx) {
    	let form;
    	let current;
    	form = new Form({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(form.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(form, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(form.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(form, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(28:0) <Route path=\\\"/new\\\">",
    		ctx
    	});

    	return block;
    }

    // (31:0) <Route path="/search">
    function create_default_slot(ctx) {
    	let search;
    	let current;
    	search = new Search({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(search.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(search, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(search.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(search.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(search, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(31:0) <Route path=\\\"/search\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let header;
    	let h1;
    	let t1;
    	let nav;
    	let a0;
    	let t3;
    	let a1;
    	let t5;
    	let a2;
    	let t7;
    	let a3;
    	let t9;
    	let route0;
    	let t10;
    	let route1;
    	let t11;
    	let route2;
    	let t12;
    	let route3;
    	let current;

    	route0 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: {
    				path: "/index",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route2 = new Route({
    			props: {
    				path: "/new",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route3 = new Route({
    			props: {
    				path: "/search",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "hyper63 Search Demo";
    			t1 = space();
    			nav = element("nav");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t3 = text(" |\n    ");
    			a1 = element("a");
    			a1.textContent = "Create Index";
    			t5 = text(" |\n    ");
    			a2 = element("a");
    			a2.textContent = "Add Search Document";
    			t7 = text(" |\n    ");
    			a3 = element("a");
    			a3.textContent = "Run Search";
    			t9 = space();
    			create_component(route0.$$.fragment);
    			t10 = space();
    			create_component(route1.$$.fragment);
    			t11 = space();
    			create_component(route2.$$.fragment);
    			t12 = space();
    			create_component(route3.$$.fragment);
    			add_location(h1, file$3, 9, 2, 175);
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$3, 11, 4, 216);
    			attr_dev(a1, "href", "/index");
    			add_location(a1, file$3, 12, 4, 243);
    			attr_dev(a2, "href", "/new");
    			add_location(a2, file$3, 13, 4, 283);
    			attr_dev(a3, "href", "/search");
    			add_location(a3, file$3, 14, 4, 328);
    			add_location(nav, file$3, 10, 2, 206);
    			add_location(header, file$3, 8, 0, 164);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(header, t1);
    			append_dev(header, nav);
    			append_dev(nav, a0);
    			append_dev(nav, t3);
    			append_dev(nav, a1);
    			append_dev(nav, t5);
    			append_dev(nav, a2);
    			append_dev(nav, t7);
    			append_dev(nav, a3);
    			insert_dev(target, t9, anchor);
    			mount_component(route0, target, anchor);
    			insert_dev(target, t10, anchor);
    			mount_component(route1, target, anchor);
    			insert_dev(target, t11, anchor);
    			mount_component(route2, target, anchor);
    			insert_dev(target, t12, anchor);
    			mount_component(route3, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const route0_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    			const route3_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				route3_changes.$$scope = { dirty, ctx };
    			}

    			route3.$set(route3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t9);
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t10);
    			destroy_component(route1, detaching);
    			if (detaching) detach_dev(t11);
    			destroy_component(route2, detaching);
    			if (detaching) detach_dev(t12);
    			destroy_component(route3, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Route, Index, Form, Search });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    new App({target: document.body});

}());
