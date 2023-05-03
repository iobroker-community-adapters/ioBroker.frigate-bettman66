'use strict';
/*
 *
 *      ioBroker frigate Adapter
 *
 *      (c) 2023 bettman66<w.zengel@gmx.de>
 *
 *      MIT License
 *
 */

const utils = require('@iobroker/adapter-core');

class Frigate extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'frigate',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.log.info('MQTT Frigate Object: ' + this.config.mqttObject);
        this.subscribeForeignStates(this.config.mqttObject + '.*');
        this.subscribeStates('*');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            callback();
        } catch (e) {
            callback();
        }
    }

    async onAdapterobjectChange(id, state) {
        const type = typeof state.val;
        const idArr = id.split('.');
        const adapterID = idArr[0] + '.' + idArr[1];
        this.log.debug(
            `onAdapterobjectChangebegin -> adapterID: ${adapterID} id: ${id} changed: ${state.val} (ack = ${state.ack})`,
        );
        if (type == 'boolean') {
            let def;
            const obj = id.replace(adapterID, this.config.mqttObject);
            if (state.val) {
                def = 'ON';
            } else {
                def = 'OFF';
            }
            this.log.debug(`onAdapterobjectChangeend -> id: ${obj} changed: ${def} (ack = ${state.ack})`);
            this.setForeignState(obj, { val: def, ack: false });
        } else if (type == 'number') {
            const obj = id.replace(adapterID, this.config.mqttObject);
            this.log.debug(`onAdapterobjectChangeend -> id: ${obj} changed: ${state.val} (ack = ${state.ack})`);
            this.setForeignState(obj, { val: state.val, ack: false });
        }
    }

    async onObjectChange(id, state) {
        const obj = id.replace(this.config.mqttObject + '.', '');
        const obj0 = obj.match('set');
        const type = typeof state.val;
        const testobj = await this.getStateAsync(obj);
        this.log.debug(`onObjectChange -> id: ${id} changed: ${state.val} (ack = ${state.ack})`);
        this.log.debug(`Object available: ${testobj} type: ${type}`);
        if (testobj == null) {
            if (type.toString() == 'string') {
                let def;
                if (state.val == 'ON') {
                    def = true;
                } else {
                    def = false;
                }
                await this.setObjectNotExistsAsync(obj, {
                    type: 'state',
                    common: {
                        name: obj,
                        type: 'boolean',
                        role: 'value',
                        read: true,
                        write: false,
                        def: def,
                    },
                    native: {},
                });
            } else if (type.toString() == 'number') {
                await this.setObjectNotExistsAsync(obj, {
                    type: 'state',
                    common: {
                        name: obj,
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: false,
                        def: state.val,
                    },
                    native: {},
                });
            }

            if (type.toString() == 'string' || type.toString() == 'number') {
                const set = obj.replace('state', 'set');
                let def;
                if (type.toString() == 'string') {
                    if (state.val == 'ON') {
                        def = true;
                    } else {
                        def = false;
                    }
                    await this.setObjectNotExistsAsync(set, {
                        type: 'state',
                        common: {
                            name: set,
                            type: 'boolean',
                            role: 'switch',
                            read: true,
                            write: true,
                            def: def,
                        },
                        native: {},
                    });
                    await this.setForeignObjectNotExistsAsync(this.config.mqttObject + '.' + set, {
                        type: 'state',
                        common: {
                            name: set,
                            type: 'string',
                            role: 'switch',
                            read: true,
                            write: true,
                            def: state.val,
                        },
                        native: {},
                    });
                } else {
                    await this.setObjectNotExistsAsync(set, {
                        type: 'state',
                        common: {
                            name: set,
                            type: 'number',
                            role: 'value',
                            read: true,
                            write: true,
                            def: state.val,
                        },
                        native: {},
                    });
                    await this.setForeignObjectNotExistsAsync(this.config.mqttObject + '.' + set, {
                        type: 'state',
                        common: {
                            name: set,
                            type: 'number',
                            role: 'value',
                            read: true,
                            write: true,
                            def: state.val,
                        },
                        native: {},
                    });
                }
            }
        } else if (obj0 == null) {
            if (type.toString() == 'string') {
                let def;
                if (state.val == 'ON') {
                    def = true;
                } else {
                    def = false;
                }
                this.setState(obj, { val: def, ack: true });
            } else this.setState(obj, { val: state.val, ack: true });
        }
    }

    async onStatsChange(obj) {
        const extractedJSON = JSON.parse(obj.val);
        const apextemperatur = extractedJSON.service.temperatures;
        this.log.info(JSON.stringify(extractedJSON));
        this.log.debug(`changed: ${obj.val}`);
        try {
            if (apextemperatur.apex_0) {
                await this.setObjectNotExistsAsync('stats' + '.temperature.apex_0', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: 'apex_0 temperature',
                        role: 'value.temperature',
                        unit: '°C',
                        def: 0,
                    },
                    native: {},
                });
                this.setState('stats' + '.temperature.apex_0', { val: apextemperatur.apex_0, ack: true });
            }
            if (apextemperatur.apex_1) {
                await this.setObjectNotExistsAsync('stats' + '.temperature.apex_1', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: 'apex_1 temperature',
                        role: 'value.temperature',
                        unit: '°C',
                        def: 0,
                    },
                    native: {},
                });
                this.setState('stats' + '.temperature.apex_1', { val: apextemperatur.apex_1, ack: true });
            }
        } catch (error) {
            this.log.error(error);
        }
    }

    async onEventChange(obj) {
        const extractedJSON = JSON.parse(obj.val);
        const beforecamera = extractedJSON.before.camera;
        const beforelabel = extractedJSON.before.label;
        const afterid = extractedJSON.after.id;
        const topscore = extractedJSON.after.top_score;
        const eventtype = extractedJSON.type;
        const id1 = beforecamera + '.event';
        const id2 = beforecamera + '.objects.' + beforelabel;
        const weburl = 'http://' + this.config.friurl;
        const websnap = weburl + '//api/events/' + afterid + '/snapshot.jpg';
        const webclip = weburl + '//api/events/' + afterid + '/clip.mp4';
        this.log.debug(`changed: ${obj.val}`);
        try {
            if (eventtype == 'new') {
                //------------------------------
                //      Bewegung erkannt
                //------------------------------
                this.setState('event', { val: true, ack: true });
                //------------------------------
                //       Kamera erkannt
                //------------------------------
                await this.setObjectNotExistsAsync(id1, {
                    type: 'state',
                    common: {
                        name: 'Camera detected',
                        type: 'boolean',
                        role: 'indicator',
                        read: true,
                        write: false,
                        def: false,
                    },
                    native: {},
                });
                this.setState(id1, { val: true, ack: true });
                //------------------------------
                //       Objekt erkannt
                //------------------------------
                await this.setObjectNotExistsAsync(id2 + '.event', {
                    type: 'state',
                    common: {
                        name: beforelabel + ' detected',
                        type: 'boolean',
                        role: 'indicator',
                        read: true,
                        write: false,
                        def: false,
                    },
                    native: {},
                });
                this.setState(id2 + '.event', { val: true, ack: true });
            } else if (eventtype == 'end') {
                //------------------------------
                //         Event ID
                //------------------------------
                await this.setObjectNotExistsAsync(id2 + '.id', {
                    type: 'state',
                    common: {
                        name: 'Event ID',
                        type: 'string',
                        role: 'value',
                        read: true,
                        write: false,
                        def: 'none',
                    },
                    native: {},
                });
                this.setState(id2 + '.id', { val: afterid, ack: true });
                //------------------------------
                //           WebURL
                //------------------------------
                const anz = this.config.webnum;
                for (let i = 0; i < anz; i++)
                    await this.setObjectNotExistsAsync(id2 + '.web.snap.snap_' + i.toString(), {
                        type: 'state',
                        common: {
                            name: 'Snapshot WebUrl ' + i.toString(),
                            type: 'string',
                            role: 'value',
                            read: true,
                            write: false,
                            def: '',
                        },
                        native: {},
                    });
                for (let i = anz - 1; i > -1; i--) {
                    if (i == 0) {
                        this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: websnap, ack: true });
                    } else {
                        const str = await this.getStateAsync(id2 + '.web.snap.snap_' + (i - 1).toString());
                        if (str != null)
                            this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: str.val, ack: true });
                    }
                }
                for (let i = 0; i < anz; i++)
                    await this.setObjectNotExistsAsync(id2 + '.web.clip.clip_' + i.toString(), {
                        type: 'state',
                        common: {
                            name: 'Clip WebUrl ' + i.toString(),
                            type: 'string',
                            role: 'value',
                            read: true,
                            write: false,
                            def: '',
                        },
                        native: {},
                    });
                for (let i = anz - 1; i > -1; i--) {
                    if (i == 0) {
                        this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: webclip, ack: true });
                    } else {
                        const str = await this.getStateAsync(id2 + '.web.clip.clip_' + (i - 1).toString());
                        if (str != null)
                            this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: str.val, ack: true });
                    }
                }
                //------------------------------
                //       Erkennungsrate
                //------------------------------
                await this.setObjectNotExistsAsync(id2 + '.score', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: 'detection rate',
                        role: 'value.score',
                        unit: '%',
                        def: 0,
                    },
                    native: {},
                });
                this.setState(id2 + '.score', { val: Math.round(topscore * 100), ack: true });
                //------------------------------
                //      Reset Event States
                //------------------------------
                this.setState('event', { val: false, ack: true });
                this.setState(id1, { val: false, ack: true });
                this.setState(id2 + '.event', { val: false, ack: true });
            }
        } catch (error) {
            this.log.error(error);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (!id || !state) return;
        const id0 = this.config.mqttObject;
        const obj0 = id.match(id0);
        if ((obj0 == null && state.ack) || (obj0 != null && !state.ack)) return;
        this.log.debug(`id: ${id} changed: ${state.val} (ack = ${state.ack})`);
        switch (id) {
            case id0 + '.events':
                this.onEventChange(state);
                break;
            case id0 + '.stats':
                this.onStatsChange(state);
                break;
            case id0 + '.available':
                this.setState('available', { val: state.val, ack: true });
                break;
            default:
                if (!state.ack) this.onAdapterobjectChange(id, state);
                else this.onObjectChange(id, state);
                break;
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Frigate(options);
} else {
    // otherwise start the instance directly
    new Frigate();
}
