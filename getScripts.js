#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');

//Execute script using node getScripts.js {site url} {fileNameSearchTerm}
//EG: node getScripts.js https://imgur.com css

/* ============================================================
  Native Recursive Directory Function
============================================================ */

const path = require('path');

function mkDirByPathSync(targetDir, {
  isRelativeToScript = false
} = {}) {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') { // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || caughtErr && curDir === path.resolve(targetDir)) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
}

/* ============================================================
  Promise-Based Download Function
============================================================ */

const download = (url, destination, fileNameSearchTerm, hostname) => new Promise((resolve, reject) => {

  mkDirByPathSync(`./files/${hostname}/${fileNameSearchTerm}`);

  destination = `./files/${hostname}/${fileNameSearchTerm}/${destination}`

  const file = fs.createWriteStream(destination);

  https.get(url, response => {
    response.pipe(file);

    file.on('finish', () => {
      file.close(resolve(true));
    });
  }).on('error', error => {
    fs.unlink(destination);

    reject(error.message);
  });

});

/* ============================================================
  Get Files
============================================================ */

function main() {
  let url = process.argv[2];
  let fileNameSearchTerm = process.argv[3];
  let showRejects = process.argv[4];

  if (url == null) {
    console.log("Please enter a url as the first parameter. e.g. https://imgur.com");
    return;
  }

  if (fileNameSearchTerm == null) {
    console.log("Please enter a file Name Search Term as the 2nd parameter. e.g. css, js, bootstrap or jquery");
    return;
  }

  if (showRejects == null) {
    console.log("To show all requests in the console enter 1 as the last parameter in the request");
    
  }

  console.log(`Searching: ${url}`);

  (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Emitted when the page produces a request
    console.group(`Files containing the search term: ${fileNameSearchTerm} were requested:`);
    page.on('request', request => {
      let requestUrl = request.url();

      if (!requestUrl.includes(fileNameSearchTerm)) {
        if (showRejects == 1) {
          console.info("Non " + fileNameSearchTerm + "file found but NOT requested at " + requestUrl)
        }
      } else if (requestUrl.includes(fileNameSearchTerm) && !requestUrl.includes("base64")) {

        let filename = requestUrl.substring(requestUrl.lastIndexOf('/') + 1);
        let {
          hostname
        } = new URL(url);
        console.info("Filename " + requestUrl + " Downloaded to " + "./files/" + hostname + "/" + "/" + filename + "." + fileNameSearchTerm)
        download(requestUrl, filename, fileNameSearchTerm, hostname);
      } else console.info("Something went wrong")
    });
    console.groupEnd();

    // Emitted after the page is closed
    page.once('close', () => console.info('Page is closed'));

    await page.goto(url);
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.24601')

    //const cookies = await page.cookies()
    //console.log(cookies)

    await browser.close();

  })();
}

main();