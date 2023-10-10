import * as playwright from "playwright";

const url = "https://www.mintscan.io";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const parts = arg.split("=");
    parts[0].replaceAll(/[. ]/g, "-");
    return parts;
  })
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getChains() {
  const chains = [];
  const browser = await playwright["firefox"].launch({
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector('[data-type="text-with-sub-text"]');
  const cells = await page.$$('[data-type="text-with-sub-text"]');

  for (const cell of cells) {
    const chain = await cell.$(".text");
    if (chain) {
      const text = await chain.innerText();
      chains.push(text.toLowerCase().replaceAll(/[. ]/gi, "-"));
    }
  }
  return chains;
}

async function main() {
  try {
    const userWallet = Object.entries(args).filter(
      ([key]) => key !== "browser"
    );
    const chains = await getChains();

    for (const [chain, address] of userWallet) {
      if (chains.includes(chain)) {
        const browser = await playwright["firefox"].launch({
          headless: false,
        });

        const context = await browser.newContext();

        const page = await context.newPage();

        await page.goto(url + `/${chain}/address/${address}`, {
          waitUntil: "domcontentloaded",
        });

        await page.waitForFunction(
          () => document.querySelectorAll("[data-data-table]").length > 1
        );

        const tables = await page.$$("[data-data-table]");

        for (const table of tables) {
          await table.waitForSelector("[data-table-cell]", {
            state: "attached",
          });

          const transactions = await table.$$("a");

          for (const tx of transactions) {
            const href = await tx.getAttribute("href");
            if (href.startsWith("/cosmos/tx")) {
              const pagePromise = context.waitForEvent("page");
              await tx.click();
              const newPage = await pagePromise;
              await newPage.waitForLoadState("domcontentloaded");

              await newPage.waitForSelector(
                '[data-button=""][data-size="md"][data-border="soft"]',
                {
                  state: "visible",
                }
              );
              const button = await newPage.$(
                '[data-button=""][data-size="md"][data-border="soft"]'
              );
              if (button) {
                await button.click();
              }

              await sleep(3000);
              await newPage.close();
            }
          }
        }

        await browser.close();
      }
    }
  } catch (err) {
    console.log(err);
  }
}

main();
