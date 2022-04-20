require('dotenv/config');

module.exports = async function deleteMessages(authToken, authorId, channelId, afterMessageId) {
    const fetch = require("node-fetch");
    const wait = async (ms) => new Promise(done => setTimeout(done, ms));

    const start = new Date();
    let delayDelete = Math.floor(Math.random() * 1500) + 500;
    let delaySearch = 10000;
    let delCount = 0;
    let failCount = 0;
    let estimatedPing = 220;
    let grandTotal;
    let throttledCount = 0;
    let throttledTotalTime = 0;

    const msToHMS = (s) => `${s / 3.6e6 | 0}h ${(s % 3.6e6) / 6e4 | 0}m ${(s % 6e4) / 1000 | 0}s`;

    console.log(`Started at ${start.toLocaleString()}`);
    console.log(`channelId=${channelId} authorId=${authorId} firstMessageId=${afterMessageId}`);
    console.log(`---- You can abort by setting Ctrl+C on the console ----`);
    await recurse();

    async function recurse() {
        const headers = {
            "Authorization": authToken
        };
        const deleteAfter = `search?author_id=${authorId}` + (afterMessageId ? `&min_id=${afterMessageId}` : '');
        const baseURL = `https://discordapp.com/api/v6/channels/${channelId}/messages/`;

        let resp;
        try {
            resp = await fetch(baseURL + deleteAfter, {
                headers
            });
        } catch (err) {
            console.log('Something went wrong!', err);
            return;
        }

        // not indexed yet
        if (resp.status === 202) {
            const w = (await resp.json()).retry_after;
            throttledCount++;
            throttledTotalTime += w;
            console.log(`This channel wasn't indexed, waiting ${w} ms for discord to index it...`);
            await wait(w);
            return recurse();
        }

        if (!resp.ok) {
            if (resp.status === 429) {
                const r = await resp.json();
                const x = r.retry_after;
                throttledCount++;
                throttledTotalTime += x;
                console.log(`! Rate limited by the API! Waiting ${x} ms ...`);
                await wait(x);
                return recurse();
            } else {
                console.log('API respondend with non OK status!', await resp.json());
                return;
            }
        }

        let response = await resp.json();
        let result = {
            messages: [],
            total_results: 0.
        }


        for(msg of response.messages){
            if(msg[0].content != ""){
                result.messages.push(msg)
            }
            else if(msg[0].attachments.length > 0){
                result.messages.push(msg)
            }
        }
        result.total_results = result.messages.length

        let total = result.total_results;
        if (!grandTotal) grandTotal = total;
        console.log(`Messages to delete: ${result.total_results}`, `Time remaining: ${msToHMS((delaySearch * Math.round(total / 25)) + ((delayDelete + estimatedPing) * total))} (ping: ${estimatedPing << 0}ms)`);

        if (result.total_results > 0) {
            for (let i = 0; i < result.messages.length; i++) {
                const element = result.messages[i];
                for (let j = 0; j < element.length; j++) {
                    const message = element[j];

                    if (message.type === 3) {
                        console.log('Found a System message!? skipping it...', message);
                    } else if (message.author.id == authorId && message.hit == true) {

                        console.log(`${((delCount + 1) / grandTotal * 100).toFixed(2)}% (${delCount + 1}/${grandTotal}) Deleting ID:${message.id}`,
                            `[${new Date(message.timestamp).toLocaleString()}] ${message.author.username}#${message.author.discriminator}: ${message.content}`,
                            message.attachments.length ? message.attachments : '');
                        const s = Date.now();

                        let resp;
                        try {
                            resp = await fetch(baseURL + message.id, {
                                headers,
                                method: "DELETE"
                            });
                            delCount++;
                        } catch (err) {
                            console.log('Failed to delete message:', message, 'Error:', err);
                            failCount++;
                        }

                        if (!resp.ok) {
                            if (resp.status === 429) {
                                const r = await resp.json();
                                const x = r.retry_after;
                                throttledCount++;
                                throttledTotalTime += x;
                                console.log(`! Rate limited by the API! Waiting ${x} ms ...`);
                                await wait(x);
                                i--;
                            } else {
                                console.log('API respondend with non OK status!', resp);
                            }
                        }
                        estimatedPing = (estimatedPing + (Date.now() - s)) / 2;
                        await wait(delayDelete);
                    }
                }
            }
            console.log('Getting next messages...');
            await wait(delaySearch);
            return recurse();
        } else {
            console.log('---- DONE! ----');
            console.log(`Ended at ${new Date().toLocaleString()}! Total time: ${msToHMS(Date.now() - start.getTime())}`);
            console.log(`Rate Limited: ${throttledCount} times. Total time throttled: ${msToHMS(throttledTotalTime)}`);
            console.log(`Deleted ${delCount} messages , ${failCount} failed.`);
            return result;
        }
    }
}

