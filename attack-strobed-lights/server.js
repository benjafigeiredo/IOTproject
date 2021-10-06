'use strict';
// toDo:
// -try to test it. 

//#region instantiate app

const SmartApp = require('@smartthings/smartapp');
const app = new SmartApp();
const {SmartThingsClient, BearerTokenAuthenticator} = require('@smartthings/core-sdk')
const client = new SmartThingsClient(new BearerTokenAuthenticator('cde6d476-ebe2-4ea1-b4e4-752370f76312')) // PAT token

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
//const dataProfile = '{"name": "profile_001", "id":"id_profile_001", "components":[{"id":"main", "capabilities":[{"id":"motionSensor"},{"id":"switch"},{"id":"switchLevel"}]}]}';
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
                .capabilities(['motionSensor'])
        });
        page.section('TurnOffLights', (section) => 
        {
            section.deviceSetting('lights')
                .name('SelectLights')
                .description('Tap to set')
                .capabilities(['switchLevel', 'switch']) 
                .multiple(true)
                .permissions('rx')
        });
        page.section('timer', (section) => 
        {
            section.numberSetting('offDelay').name('numberOfMinutes').defaultValue("0");
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

        /*return Promise.all([
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion', 'myHandler')
        ])*/

        return Promise.all([
            ctx.api.subscriptions.subscribeToDevices(ctx.config.motionSensors, 'motionSensor', 'motion.active', 'motionDetectedHandler'),
            ctx.api.subscriptions.subscribeToDevices( ctx.config.motionSensors, 'motionSensor', 'motion.inactive', 'motionStoppedHandler')
        ])
    })
    //#endregion

    //#region eventHandler myHandler
    .subscribedEventHandler('myHandler', (ctx, event) => 
    {
        // const switchState = client.devices.getCapabilityStatus(event.deviceId, 'main', 'switchLevel'); 

        console.log(`attack`);
        const delay = ctx.configNumberValue('offDelay');
        return ctx.api.schedules.runIn('changeIntensity', delay*60, false);

    })
    //#endregion

    //#region eventHandler motionDetectedHandler
    // when motion is detected, then on the switches
    .subscribedEventHandler('motionDetectedHandler', (ctx, event) => 
    {
        const result = [ctx.api.devices.sendCommands(ctx.config.lights, "switch", "on")]
        return Promise.all(result)
    })
    //#endregion

    //#region eventHandler motionStoppedHandler
    // when the motion is stopped (the motion value is changed to "inactive") then call the checkmotion schedule
    .subscribedEventHandler('motionStoppedHandler', async (ctx, event) => 
    {
        console.log(`motionStoppedHandler called`);
        const delay = ctx.configNumberValue('offDelay');
        return ctx.api.schedules.runIn('checkMotion', delay*60, false);
    })
    //#endregion

    //#region scheduledEventHandler changeIntensity
    // change the intensity of the light when no one is home. 
    // toDo: 
    // - check the add boolean atribute. 
    // - find about the getattributevalue method. 
    .scheduledEventHandler ('changeIntensity', async (ctx, event) => 
    {
        // Changed state.add to a boolean variable. its right?
        // the add variable it's for check if we've to increment or decrement the level of the switch.
        const add = false; 
        const quiet = await othersQuiet(ctx, ctx.config.motionSensors, event.deviceId);
        if (!quiet)
        {
            await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', 80);
            console.log(`Stop attack`);
        }
        else
        {
            const levelValue = await ctx.api.devices.getAttributeValue(event.deviceId, 'switchLevel', 'level'); // ok?
            if (levelValue <= 20)
            {
                add = true; 
                await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', levelValue + 20);
                const aux = levelValue + 20; 
                console.log (`value: ${aux}`);
            }

            if (levelValue > 20 && levelValue < 80 && add)
            {
                await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', levelValue + 20);
                const aux = levelValue + 20; 
                console.log (`value: ${aux}`);
            }

            if (levelValue <= 80)
            {
                add = false; 
                await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', levelValue - 20);
                const aux = levelValue - 20; 
                console.log (`value: ${aux}`);
            }

            if (levelValue > 20 && levelValue < 80 && !add)
            {
                await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', levelValue - 20);
                const aux = levelValue - 20; 
                console.log (`value: ${aux}`);
            }

            return ctx.api.schedules.runIn('changeIntensity', 60*0.1, false);
        }
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
            const lastTimeInactive = new Date (ctx.api.devices.getCapabilityStatus (event.deviceId, 'main', 'motionSensor').motion.timestamp); // ok?
            const elapsed = new Date() - lastTimeInactive; 
            const threshold = 1000 * 60 * ctx.configNumberValue('offDelay')*0.1; 
    
            if (elapsed >= threshold)
            {
                console.log(`(${elapsed} ms): not home!!!`);
                await ctx.api.devices.sendCommands(ctx.config.lights, 'switchLevel', 'setLevel', 0);
                console.log(`Attack`);
                return ctx.api.schedules.runIn('changeIntensity', 60*0.1);
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
//#endregion



//#region starts the server
server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));
//#endregion


//#region test 
client.deviceProfiles.list().then(deviceProfiles => { console.log(`Found ${deviceProfiles.length} deviceProfiles`) })

client.locations.list().then(locations => { console.log(`Found ${locations.length} locations`) })

//client.subscriptions.subscribeToDevices() 
//client.deviceProfiles.create(dataProfile);
//client.schedules.runIn();
//client.devices.getAttributeValue()  

//#endregion