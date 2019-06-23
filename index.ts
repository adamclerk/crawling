import fetch from 'node-fetch';
import cheerio from 'cheerio';
import PromisePool from 'es6-promise-pool';

interface iTarget {
  depth: number;
  url: string;
}

const term = process.argv[3];
const target = process.argv[2];
const depth = 2;
const concurrency = 1;

const visited = {};

const stack: iTarget[] = [{
  depth: 0,
  url: target
}];

const result = {};

const producer = () => {
  if (stack.length === 0) {
    return null;
  }

  const current = stack.shift()!;
  visited[current.url] = true;
  return fetch(current.url).then(pageResult => {
    const percentDone = (Object.keys(visited).length / stack.length * 100).toFixed(2);
    console.log(`${percentDone}% - ${stack.length}`);
    return pageResult.text();
  }).then(body => {
    const $ = cheerio.load(body);
    const text = $('body').text();
    const targetIndex = text.indexOf(term);
    if (targetIndex > -1) {
      result[current.url] = text.substr(targetIndex - 20, 40);
    }

    if (current.depth < depth) {

      const selector = `a[href^="${target}"],a[href^="/"]`;
      $(selector).each((x, ele) => {
        const href = ele.attribs.href
        let fullanchor = href;
        if (href.indexOf('/') === 0) {
          fullanchor = `${target}${href}`;
        }
        if (visited[fullanchor] === undefined) {
          stack.push({
            depth: current.depth + 1,
            url: fullanchor
          });
        }
      });
    }
    return;
  });
}


let pool = new PromisePool(producer, concurrency);

pool.start().then(x => {
  console.log(`Crawled ${Object.keys(visited).length} pages. Found ${Object.keys(result).length} pages with the term '${term}'`);
  Object.keys(result).forEach(x => {
    console.log(`${x} => '${result[x]}'`);
  });
}, x => {
  console.log('error', x);
});

pool.addEventListener('fulfilled', (event) => {
  if (stack.length > 10) {
    pool.concurrency(5);
  }
  // if (stack.length > 100) {
  //   pool.concurrency(20);
  // }

  // if (stack.length > 1000) {
  //   pool.concurrency(50);
  // }
});
