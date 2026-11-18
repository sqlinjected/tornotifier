# tornotifier

userscript that plays a sound when stuff happens in torn. made it so i don't have to keep checking the page during wars.

still early, adding alerts as i go.

## what it does

- enemy leaves hospital
- oc ready
- energy/nerve full
- drug/booster cooldown done
- landing from travel

## install

get [tampermonkey](https://www.tampermonkey.net/) (or use torn pda on mobile), open `tornotifier.user.js`, hit raw, and install.

it'll ask for your api key the first time. a limited access key works. click the page once after it loads or your browser won't let it play sound.

## api key

your key stays in your browser and only gets sent to api.torn.com. nothing's stored or shared anywhere else. it only reads data and never does anything in game for you.

it checks the api every 30 sec so it doesn't hit the rate limit.

## license

MIT
