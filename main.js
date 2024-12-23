'use strict';

var ari = require('ari-client');
var util = require('util');

// if (!process.argv[2]) {
//   console.error('usage: node main.js endpoint');
//   process.exit(1);
// }

ari.connect('http://localhost:8088', 'asterisk', 'asterisk', clientLoaded);

function clientLoaded (err, client) {
    if (err) {
        throw err;
    }

    function stasisStart(event, channel){
        var dialed = event.args[0] === 'dialed';

        if (!dialed) {
            channel.answer(function(err) {
                if (err) {
                    throw err;
                }
                console.log('Channel %s has entered our application', channel.name);

                var playback = client.Playback();
                channel.play({media: 'sound:pls-wait-connect-call'}, 
                    playback, function(err, playback) {
                        if (err) {
                            throw err;
                        }
                    });

                    originate(channel);
            });
        }
    }

    function originate(channel){
        var dialed = client.Channel();

        channel.on('StasisEnd', function(event, channel) {
            hangupDialed(channel, dialed);
        });

        dialed.on('ChannelDestroyed', function(event, dialed) {
            hangupOriginal(channel, dialed);
        });

        dialed.on('StasisStart', function(event, dialed) {
            joinMixingBridge(channel, dialed);
        });

        dialed.originate(
            {endpoint: process.argv[2], app: 'js-call', appArgs: 'dialed'},
            function(err, dialed) {
                if (err) {
                    throw err;
                }
            }
        );
    }

    function hangupDialed(channel, dialed){
        console.log('Channel %s has left our application, hangin up dialed channel %s',
             channel.name, dialed.name);

        dialed.hangup(function(err) {
            if (err) {
                throw err;
            }
        });
    }

    function hangupOriginal(channel, dialed){
        console.log('Dialed channel %s has been hung up, hanging up channel %s',
            dialed.name, channel.name);

        channel.hangup(function(err) {
            if (err) {
                throw err;
            }
        });
    }

    function joinMixingBridge(channel, dialed){
        var bridge = client.Bridge();

        dialed.on('StasisEnd', function(event, dialed) {
            console.log('Dialed channel %s has left our application', dialed.name);
            dialedExit(channel, bridge);
        });

        dialed.answer(function(err){
            if (err) {
                throw err;
            }
        });

        bridge.create({type: 'mixing'}, function(err, bridge){
            if (err) {
                throw err;
            }

            console.log('Created bridge %s', bridge.id);
            addChannelsToBridge(channel, dialed, bridge);
        });
    }

    function dialedExit(channel, bridge){
        console.log('Dialed channel %s has left our application, leaving bridge %s',
            channel.name, bridge.id);
        
        bridge.destroy(function(err){
            if (err) {
                throw err;
            }
        });
    }

    function addChannelsToBridge(channel, dialed, bridge){
        console.log('Adding channel %s and dialed channel %s to bridge %s',
            channel.name, dialed.name, bridge.id);
        
        bridge.addChannel({channel: [channel.id, dialed.id]}, function(err){
            if (err) {
                throw err;
            }
        });
    }

    client.on('StasisStart', stasisStart);
    client.start('js-call');
}
