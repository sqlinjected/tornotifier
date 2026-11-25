# tornotifier

Tornotifier is a Torn City userscript that plays a sound when events happen in torn. Created so you do not have to keep checking various pages during wars.


## features

- [x] enemy leaves hospital
- [x] oc ready / oc status changes
- [x] energy/nerve full
- [x] drug/booster cooldown done
- [x] landing from travel

## install

get [tampermonkey](https://www.tampermonkey.net/) if on pc, and [tornpda](https://github.com/Manuito83/torn-pda) if on mobile, and open `tornotifier.user.js`, hit raw, and install the userscript.

tornotifier will ask for your api key the first time. a limited access key works. click the page once after it loads or your browser won't let it play sound.

tampermonkey will update the userscript on its own when there's a new version.

## settings

click the **`tn`** button in the bottom left of torn to:

- set the enemy faction id to watch
- mute/unmute
- play a test sound
- reset your api key
- turn each alert on or off

## api key

your key stays in your browser and only gets sent to api.torn.com. nothing's stored or shared anywhere else. it only reads data and never does anything in game for you.

it checks the api at 30s intervals by default to mitigate rate limiting.

## license

MIT
