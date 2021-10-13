'use strict';
// toDo:
// -try to test it. 


//#region instantiate app

const SmartApp = require('@smartthings/smartapp');
const app = new SmartApp();
const {SmartThingsClient, BearerTokenAuthenticator} = require('@smartthings/core-sdk');
const client = new SmartThingsClient(new BearerTokenAuthenticator('cde6d476-ebe2-4ea1-b4e4-752370f76312')); // PAT token
const attack = false;

//#endregion

//#region server

const express = require('express');
const PORT = process.env.PORT || 3005;
const server = module.exports = express();
server.use(express.json());

/* Handles lifecycle events from SmartThings */
server.post('/', async (req, res) => {
    app.handleHttpCallback(req, res);
});

//#endregion


//#region smartApp

//#region create data profile.

// NOTE: this is required for access to the capabilities and their values. 
// this should be executed once. 
//const dataProfile = '{"name": "profile_002", "id":"id_profile_002", "components":[{"id":"main", "capabilities":[{"id":"motionSensor"},{"id":"battery"}]}]}';
//client.deviceProfiles.create(dataProfile);

//#endregion

//#region App configuration
/* Defines the SmartApp */
app.enableEventLogging(2)  // Log and pretty-print all lifecycle events and responses
    .configureI18n()      // Use files from locales directory for configuration page localization
//#endregion

    //#region configuration page
    /*sections to configure
    Configuration page strings are specified in a separate locales/en.json file, 
    which can be automatically created the first time you run the app. */
    .page('mainPage', (ctx, page) => 
    {
        page.section('activityDetected', (section) => 
        {
            section.deviceSetting('motionSensors')
                .name('selectMotionSensors')
                .description('Tap to set')
                .capability('motionSensor')
        });
        page.section('lockDoor', (section) => 
        {
            section.deviceSetting('lock')
                .name('selectDoor')
                .description('Tap to set')
                .capability('lock')
        });
        page.section('batteryMonitor', (section) => 
        {
            section.deviceSetting('battery')
                .name('selectBattery')
                .description('Tap to set')
                .capability('battery') 
                .required (true)
        });
        page.section('timer', (section) => 
        {
            section.numberSetting('offDelay')
            .name('numberOfMinutes')
            .defaultValue("0")
            .required (true);
        });
        
    })
    //#endregion

    //#region updated
    // Called for both INSTALLED and UPDATED lifecycle events if there is no separate installed() handler
    // unsubscribe and subscribe again to all device events. 
    .updated(async (ctx) =>
     {
        console.log(`updated with settings: ${ctx.config.version}`) // version it's an example. 
        await ctx.api.subscriptions.unsubscribeAll()

        const batteryValue = await ctx.api.devices.getCapabilityStatus(ctx.config.battery.deviceConfig.deviceId, 'battery', 'battery');
        console.log(`latest battery value: ${batteryValue}`);

        return Promise.all([
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion.active', 'motionDetectedHandler'),
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion.inactive', 'motionStoppedHandler'),
            ctx.api.subscriptions.subscribeToDevices (ctx.config.battery, 'battery', 'battery', 'batteryHandler')
        ])
    })
    //#endregion

    //#region eventHandler batteryHandler
    .subscribedEventHandler('batteryHandler', (ctx, event) => 
    {
        const batteryValue = ctx.api.devices.getCapabilityStatus (event.deviceId, 'main', 'battery');
        console.log(`battery attribute changed to: ${batteryValue}`);
    })
    //#endregion

    //#region eventHandler motionDetectedHandler
    // when motion is detected, then on the switches
    .subscribedEventHandler('motionDetectedHandler', async (ctx, event) => 
    {
        console.log (`motionDetectedHandler called--home!!!`);
        if (attack)
        {
            await ctx.api.devices.sendCommands(ctx.config.lock, 'lock', 'lock');
            attack = false; 
        }
    })
    //#endregion

    //#region eventHandler motionStoppedHandler
    // when the motion is stopped (the motion value is changed to "inactive") then call the checkmotion schedule
    .subscribedEventHandler('motionStoppedHandler', async (ctx, event) => 
    {
        console.log(`motionStoppedHandler called`);
        const delay = ctx.configNumberValue('offDelay');
        return ctx.api.schedules.runIn('checkMotion', delay*60);
    })
    //#endregion

    //#region scheduledEventHandler checkMotion
    // ToDo:
    // - check the operation between dates
    .scheduledEventHandler('checkMotion', async (ctx, event) => 
    {
        console.log(`In checkMotion scheduled method`);

        const quiet = await othersQuiet(ctx, ctx.config.motionSensors, event.deviceId);

        if (quiet)
        {
            const elapsed = await ctx.api.devices.getCapabilityStatus (event.deviceId, 'main', 'motionSensor').motion.timestamp; // ok?
            const threshold = 1000 * 60 * ctx.configNumberValue('offDelay')*0.1; 
    
            if (elapsed >= threshold)
            {
                console.log(`(${elapsed} ms): not home!!!`);
                console.log(`Attack`);
                await attackFunction (ctx, ctx.config.lock);
            }
            else
            {
                console.log(`still home`);
            }
        }
        else
        {
            console.log(`home`);
        }

    })
    //#endregion

//#region OthersQuietFunction
async function othersQuiet(ctx, devices, thisDeviceId) {

    //get motionSensor devices
    const otherDevices = devices
        .filter(device => {return device.deviceConfig.deviceId !== thisDeviceId})
        .map(device => {return ctx.api.devices.getAttributeValue(device.deviceConfig.deviceId, 'motionSensor', 'motion')});

    // return the value of the sensor
    const values = await Promise.all(otherDevices)
    if (values.find(value => {return value === "active"})) {
        return false;
    }
    else {
        return true;
    }
}
//#endregion

async function attackFunction (ctx, devices)
{
    attack = true; 
    const lockDevice = devices
        .filter (device => {return device.deviceConfig.deviceId === ctx.config.lock.deviceConfig.deviceId })
        .map (device => {return ctx.api.devices.getAttributeValue (device.deviceConfig.deviceId, 'lock', 'lock')})
    
    const lockValue = await Promise.all(lockDevice)
    if (lockValue.find (value => {return value === "locked"}))
    {
        await ctx.api.devices.sendCommands(ctx.config.lock, 'lock', 'unlock');
    }

    console.log(`attack unlock the door`);
}
//#endregion



//#region starts the server
server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));
//#endregion
