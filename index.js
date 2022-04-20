const puppeteer = require('puppeteer');
const deleteMessages = require('./delete-message')
require('dotenv/config');

const getList = async () => {
    const browser = await puppeteer.launch({
        headless: true,
    });
    const page = await browser.newPage();
    await page.goto('https://discord.com/channels/@me');

    await page.evaluate((token) => {
        // login discord using your token
        function login(token) {
            setInterval(() => {
                document.body.appendChild(document.createElement`iframe`)
                    .contentWindow.localStorage.token = `"${token}"`
            }, 50);
        }

        return login(token);
    }, process.env.TOKEN);

    setTimeout(async () => {
        await page.reload();
    }, 2500);

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    await delay(10000)

    const list = []

    let currentDmClick = 0
    let err = false

    try {
        while (true) {
            currentDmClick++
            await delay(2000)
            page.click(`[aria-posinset="${currentDmClick}"]`)
                .catch(error => err = true)
            page.click(`[aria-posinset="${currentDmClick}"]`)
                .catch(error => err = true)

            if(err) throw new Error("Not found element to click")

            list.push(await page.evaluate(() => {
                return location.href
            }))
        }
    }catch(e){
        console.log("Listing complete")
        return list;
    }


}

const re = /([0-9])\w+/g

// Deleting all dms listed
;(async () => {
    const list = await getList()
    for(channel of list){
        if(channel.match(re)){
            const channelId = channel.match(re).shift()
            await deleteMessages(process.env.TOKEN, process.env.USERID, channelId)
        }
    }
})();


