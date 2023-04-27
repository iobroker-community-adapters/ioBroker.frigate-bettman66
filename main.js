// @ts-nocheck
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
        this.on('eventChange', this.onEventChange.bind(this));
        this.on('statsChange', this.onStatsChange.bind(this));
        this.on('availableChange', this.onAvailableChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.log.info('MQTT Frigate Object: ' + this.config.mqttObject);
        this.subscribeForeignStates(this.config.mqttObject + '.*');
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

    async onObjectChange(id, state) {
        const obj = id.replace(this.config.mqttObject + '.', '');
        this.log.debug(`state ${obj} changed: ${state.val} (ack = ${state.ack})`);
        let type = typeof state.val;
        await this.setObjectNotExistsAsync(obj, {
            type: 'state',
            common: {
                name: obj,
                type: type.toString(),
                role: 'value',
                read: true,
                write: true
            },
            native: {},
        });
        this.setState(obj, { val: state.val, ack: true });
    }

    async onAvailableChange(obj) {
        this.log.debug(`changed: ${obj.val}`);
        await this.setObjectNotExistsAsync('available', {
            type: 'state',
            common: {
                name: 'frigate online',
                type: 'string',
                role: 'indicator',
                read: true,
                write: false,
                def: ''
            },
            native: {},
        });
        this.setState('available', { val: obj.val, ack: true });
    }

    async onStatsChange(obj) {
        const extractedJSON = JSON.parse(obj.val);
        const apextemperatur = extractedJSON.service.temperatures;
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
                        def: 0
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
                        def: 0
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
                await this.setObjectNotExistsAsync('event', {
                    type: 'state',
                    common: {
                        name: 'Motionevent detected',
                        type: 'boolean',
                        role: 'indicator',
                        read: true,
                        write: false,
                        def: false
                    },
                    native: {},
                });
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
                        def: false
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
                        def: false
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
                        def: 'none'
                    },
                    native: {},
                });
                this.setState(id2 + '.id', { val: afterid, ack: true });
                //------------------------------
                //           WebURL
                //------------------------------
                for (let i = 0; i < 10; i++)
                    await this.setObjectNotExistsAsync(id2 + '.web.snap.snap_' + i.toString(), {
                        type: 'state',
                        common: {
                            name: 'Snapshot WebUrl ' + i.toString(),
                            type: 'string',
                            role: 'value',
                            read: true,
                            write: false,
                            def: ''
                        },
                        native: {},
                    });
                for (let i = 9; i > -1; i--) {
                    if (i == 0) {
                        this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: websnap, ack: true });
                    } else {
                        this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: (await this.getStateAsync(id2 + '.web.snap.snap_' + (i - 1).toString())).val, ack: true });
                    }
                }
                for (let i = 0; i < 10; i++)
                    await this.setObjectNotExistsAsync(id2 + '.web.clip.clip_' + i.toString(), {
                        type: 'state',
                        common: {
                            name: 'Clip WebUrl ' + i.toString(),
                            type: 'string',
                            role: 'value',
                            read: true,
                            write: false,
                            def: ''
                        },
                        native: {},
                    });
                for (let i = 9; i > -1; i--) {
                    if (i == 0) {
                        this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: webclip, ack: true });
                    } else {
                        this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: (await this.getStateAsync(id2 + '.web.clip.clip_' + (i - 1).toString())).val, ack: true });
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
                        def: 0
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
        if (state) {
            const id0 = this.config.mqttObject;
            if (id == id0 + '.events') this.onEventChange(state);
            else if (id == id0 + '.stats') this.onStatsChange(state);
            else if (id == id0 + '.available') this.onAvailableChange(state);
            else this.onObjectChange(id,state);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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