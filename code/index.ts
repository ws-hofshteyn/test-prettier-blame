import { reaction } from "mobx"
import { isMobileApp } from "../../../utils/globals"

interface Serialized {
    [key: string]: string
}

export interface WithState {
    deserialize(v: Serialized): void
    serialize(): Serialized
}

/**
 * Returns a state map from current URL hash location.
 * @returns {Serialized}
 */
export function getStateFromLocation(): Serialized {
    let location = window.location.href
    let state: Serialized = {}
    const p = location.split("?", -1)
    const paths = p[0].split('/', -1)
    const lastPath = paths[paths.length - 1]
    if (/live|weather|overview/.test(lastPath)) {
        state['mode'] = lastPath === 'live' ? 'notifications' : 'weather'
    }
    if (p.length > 1) {
        let hashPart = p[1]
        let items = hashPart.split('&', -1)
        for (let i of items) {
            const ix = i.indexOf('=')
            if (ix >= 0) {
                const k = i.slice(0, ix)
                const v = i.slice(ix + 1).split('#')[0]
                state[k] = decodeURIComponent(v)
            }
        }
    }
    return state
}

/**
 * Sets up browser history so that when appState.serialize() value changes, it's updated in URL,
 * and when URL changes (browser forward/backward is used), appState.deserialize() is called with
 * state from the URL.
 */
export function setupBrowserHistory(appState: WithState) {
    let updateUrl = true
    let popState = true

    function applyStateFromLocation() {
        updateUrl = false
        try {
            const state = getStateFromLocation()
            if (Object.keys(state).length > 0) {
                appState.deserialize(getStateFromLocation())
            }
        } finally {
            updateUrl = true
        }
    }

    reaction((): Serialized => {
        return appState.serialize()
    }, (newValue) => {
        if (!updateUrl || !newValue) {
            return
        }
        const state = getStateFromLocation()
        if (state['mode']) {
            delete state['mode']
        }
        const oldState = Object.assign({}, state)
        for (let k of Object.keys(newValue)) {
            state[k] = newValue[k]
        }
        for (let key in state as any) {
            if (!newValue[key]) {
                delete state[key]
            }
        }
        const p = window.location.href.split("?", -1)
        popState = false
        try {
            const func = Object.keys(oldState).length > 0 ? 'pushState' : 'replaceState'
            const newUrl = p[0] + '?' + Object.keys(state).map(k => `${k}=${encodeURIComponent(state[k])}`).join("&")
            if (newUrl !== window.location.href) {
                history[func]({}, '', newUrl)
            }
        } finally {
            popState = true
        }
    }, {
        delay: 200
    })

    window.onpopstate = () => {
        if (!popState) {
            return
        }
        applyStateFromLocation()
    }

    applyStateFromLocation()
}
