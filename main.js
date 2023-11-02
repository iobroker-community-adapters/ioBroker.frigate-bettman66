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
let weburl;
let m_id;

function seconds_to_days_hours_mins_secs_str(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds -= days * (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds -= hours * (60 * 60);
    const minutes = Math.floor(seconds / (60));
    seconds -= minutes * (60);
    return ((0 < days) ? (days + ' day: ') : '') + hours + 'h:' + minutes + 'm:' + seconds + 's';
}

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
        if (this.config.friurl.match('http') == null)
            weburl = 'http://' + this.config.friurl;
        else weburl = this.config.friurl;
        m_id = this.config.mqttObject;
        this.setState('available', { val: 'offline', ack: true });
        this.log.info('MQTT Frigate Object: ' + m_id);
        this.log.info('MQTT Frigate URL: ' + weburl);
        this.subscribeForeignStates(m_id + '.*');
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
        const obj = id.replace(adapterID, m_id);
        if (type.toString() == 'boolean') if (state.val) state.val = 'ON'; else state.val = 'OFF';
        this.log.debug(`onAdapterobjectChangeend -> id: ${obj} changed: ${state.val} (ack = ${state.ack})`);
        this.setForeignState(obj, { val: state.val, ack: false });
    }

    async onObjectChange(id, state) {
        const obj = id.replace(m_id + '.', '');
        const obj0 = obj.match('set');
        const type = typeof state.val;
        const testobj = await this.getStateAsync(obj);
        this.log.debug(`onObjectChange -> id: ${id} changed: ${state.val} (ack = ${state.ack})`);
        this.log.debug(`Object available: ${testobj} type: ${type}`);
        if (type.toString() == 'string') {
            switch (state.val) {
                case 'ON':
                    state.val = true;
                    break;
                case 'OFF':
                    state.val = false;
                    break;
                default:
                    this.log.debug(':skip mqtt snapshot:');
                    return;
            }
        }
        if (testobj == null) {
            if (type.toString() == 'string') {
                await this.setObjectNotExistsAsync(obj, {
                    type: 'state',
                    common: {
                        name: obj,
                        type: 'boolean',
                        role: 'value',
                        read: true,
                        write: false,
                        def: state.val
                    },
                    native: {},
                });
                const set = obj.replace('state', 'set');
                await this.setObjectNotExistsAsync(set, {
                    type: 'state',
                    common: {
                        name: set,
                        type: 'boolean',
                        role: 'switch',
                        read: true,
                        write: true,
                        def: state.val
                    },
                    native: {},
                });
                await this.setForeignObjectNotExistsAsync(m_id + '.' + set, {
                    type: 'state',
                    common: {
                        name: set,
                        type: 'string',
                        role: 'switch',
                        read: true,
                        write: true,
                        def: 'OFF'
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
                        def: state.val
                    },
                    native: {},
                });
                const set = obj.replace('state', 'set');
                await this.setObjectNotExistsAsync(set, {
                    type: 'state',
                    common: {
                        name: set,
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        def: state.val
                    },
                    native: {},
                });
                await this.setForeignObjectNotExistsAsync(m_id + '.' + set, {
                    type: 'state',
                    common: {
                        name: set,
                        type: 'number',
                        role: 'value',
                        read: true,
                        write: true,
                        def: state.val
                    },
                    native: {},
                });
            }
        } else if (obj0 == null) {
            this.setState(obj, { val: state.val, ack: true });
        }
    }

    async onStatsChange(obj) {
        const extractedJSON = JSON.parse(obj.val);
        const version = extractedJSON.service.version;
        const latest = extractedJSON.service.latest_version;
        const uptime = seconds_to_days_hours_mins_secs_str(extractedJSON.service.uptime);
        const arrtemperatur = String(Object.keys(extractedJSON.service.temperatures)).split(',');
        const apextemperatur = JSON.stringify(extractedJSON.service.temperatures);
        const apex = JSON.parse(apextemperatur);
        const arrstorage = String(Object.keys(extractedJSON.service.storage)).split(',');
        const arrstor = JSON.stringify(extractedJSON.service.storage);
        const stor = JSON.parse(arrstor);
        this.log.debug(`changed: ${obj.val}`);
        try {
            this.setState('available', { val: 'online', ack: true });
            this.setState('version', { val: version, ack: true });
            this.setState('latest_version', { val: latest, ack: true });
            this.setState('uptime', { val: uptime, ack: true });
            if (arrtemperatur[0] != '') {
                for (let i = 0; i < arrtemperatur.length; i++) {
                    await this.setObjectNotExistsAsync('stats' + '.temperature.' + arrtemperatur[i], {
                        type: 'state',
                        common: {
                            type: 'number',
                            read: true,
                            write: false,
                            name: arrtemperatur[i],
                            role: 'value.temperature',
                            unit: '°C',
                            def: 0,
                        },
                        native: {},
                    });
                    this.setState('stats' + '.temperature.' + arrtemperatur[i], {
                        val: apex[arrtemperatur[i]],
                        ack: true,
                    });
                }
            }
            for (let i = 0; i < arrstorage.length; i++) {
                const sto = JSON.stringify(stor[arrstorage[i]]);
                const st = JSON.parse(sto);
                let sunit, tval, uval, fval;
                if (st['mount_type'] == 'tmpfs') {
                    sunit = 'MB';
                    tval = Number(st['total']);
                    uval = Number(st['used']);
                    fval = Number(st['free']);
                } else {
                    sunit = 'GB';
                    tval = Number((st['total'] / 1000).toFixed(2));
                    uval = Number((st['used'] / 1000).toFixed(2));
                    fval = Number((st['free'] / 1000).toFixed(2));
                }
                this.log.debug(JSON.stringify(st));
                await this.setObjectNotExistsAsync('stats' + '.storage.' + arrstorage[i] + '.total', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: arrstorage[i],
                        role: 'value',
                        unit: sunit,
                        def: 0,
                    },
                    native: {},
                });
                this.setState('stats' + '.storage.' + arrstorage[i] + '.total', {
                    val: tval,
                    ack: true,
                });
                await this.setObjectNotExistsAsync('stats' + '.storage.' + arrstorage[i] + '.used', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: arrstorage[i],
                        role: 'value',
                        unit: sunit,
                        def: 0,
                    },
                    native: {},
                });
                this.setState('stats' + '.storage.' + arrstorage[i] + '.used', {
                    val: uval,
                    ack: true,
                });
                await this.setObjectNotExistsAsync('stats' + '.storage.' + arrstorage[i] + '.free', {
                    type: 'state',
                    common: {
                        type: 'number',
                        read: true,
                        write: false,
                        name: arrstorage[i],
                        role: 'value',
                        unit: sunit,
                        def: 0,
                    },
                    native: {},
                });
                this.setState('stats' + '.storage.' + arrstorage[i] + '.free', {
                    val: fval,
                    ack: true,
                });
                await this.setObjectNotExistsAsync('stats' + '.storage.' + arrstorage[i] + '.mount_type', {
                    type: 'state',
                    common: {
                        type: 'string',
                        read: true,
                        write: false,
                        name: arrstorage[i],
                        role: 'value',
                        unit: '',
                        def: '',
                    },
                    native: {},
                });
                this.setState('stats' + '.storage.' + arrstorage[i] + '.mount_type', {
                    val: st['mount_type'],
                    ack: true,
                });
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
        const websnap = weburl + '//api/events/' + afterid + '/snapshot.jpg';
        const webclip = weburl + '//api/events/' + afterid + '/clip.mp4';
        const bsnap = await this.getStateAsync(beforecamera + '.snapshots.state');
        const bclip = await this.getStateAsync(beforecamera + '.recordings.state');
        this.log.debug(`Snap: ${bsnap.val}`);
        this.log.debug(`Clip: ${bclip.val}`);
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
                //         Cam + Event ID
                //------------------------------
                await this.setObjectNotExistsAsync(id2 + '.camid', {
                    type: 'state',
                    common: {
                        name: 'Cam ID',
                        type: 'string',
                        role: 'value',
                        read: true,
                        write: false,
                        def: 'none'
                    },
                    native: {},
                });
                this.setState(id2 + '.camid', { val: beforecamera + '-' + afterid, ack: true });
                this.setState('lastcamid', { val: beforecamera + '-' + afterid, ack: true });
                //------------------------------
                //           WebURL
                //------------------------------
                const anz = this.config.webnum;
                if (bsnap?.val) {
                    for (let i = 0; i < anz; i++)
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

                    for (let i = anz - 1; i > -1; i--) {
                        if (i == 0) {
                            this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: websnap, ack: true });
                        } else {
                            const str = await this.getStateAsync(id2 + '.web.snap.snap_' + (i - 1).toString());
                            if (str != null)
                                this.setState(id2 + '.web.snap.snap_' + i.toString(), { val: str.val, ack: true });
                        }
                    }
                }
                if (bclip?.val) {
                    for (let i = 0; i < anz; i++)
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

                    for (let i = anz - 1; i > -1; i--) {
                        if (i == 0) {
                            this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: webclip, ack: true });
                        } else {
                            const str = await this.getStateAsync(id2 + '.web.clip.clip_' + (i - 1).toString());
                            if (str != null)
                                this.setState(id2 + '.web.clip.clip_' + i.toString(), { val: str.val, ack: true });
                        }
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
        if (!id || !state) return;
        const obj0 = id.match(m_id);
        if (obj0 != null) state.ack = false;
        if (state.ack) return;
        this.log.debug(`id: ${id} changed: ${state.val} (ack = ${state.ack})`);
        switch (id) {
            case m_id + '.events':
                this.onEventChange(state);
                break;
            case m_id + '.stats':
                this.onStatsChange(state);
                break;
            case m_id + '.available':
                this.setState('available', { val: state.val, ack: true });
                break;
            default:
                if (obj0 == null) this.onAdapterobjectChange(id, state);
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
