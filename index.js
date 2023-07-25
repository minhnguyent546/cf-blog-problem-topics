const puppeteer = require('puppeteer');
const fs = require('node:fs');

const fetchProblems = async (target) => {
  const url = 'https://codeforces.com/blog/entry/55274';
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
      headless: 'new',
      defaultViewport: null,
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'load' });

    const ttypography = await page.waitForSelector('.content .ttypography');
    const dropdowns = await ttypography.$$('.spoiler');
    let content = '';
    let problemCount = 0;
    for (const topic of dropdowns) {
      const title = await topic.$eval('b.spoiler-title', el => {
        return el.textContent.trim().replace(/(\s+|[_\s])/g, '-');
      });
      console.log(`\n[Fetching] ${title}...`);

      const topicProblems = await topic.$$('.spoiler-content p');
      let topicProblemCount = 0;
      for (const topicProblem of topicProblems) {
        let currentProblem = await topicProblem.evaluate(el => el.innerHTML);
        currentProblem = currentProblem.replace(/href="\//g, 'href="https://codeforces.com/'); // relative route from codeforces
        currentProblem = currentProblem.replace(/\[(.*)\]\((.*)\)/g, "[$1] ($2)"); // lead to markdown link
        content += `${title};${currentProblem}\n`;
        topicProblemCount++;
      }
      console.log(`[Done] ${topicProblemCount} problems found`);
      problemCount += topicProblemCount
    }
    console.log(`Total problems found: ${problemCount}`);
    await fs.promises.writeFile(target, content, { encoding: 'utf-8' });
  } catch (err) {
    console.log(`[error] ${err.message}`);
    process.exit(1);
  }
  await browser.close();
}

const renderMarkdown = async (source, markdown) => {
  if (!fs.existsSync(source)) {
    console.log(`[error] Failed to read file: '${source}'`);
    process.exit(1);
  }

  const topics = {};
  let content;
  try {
    content = await fs.promises.readFile(source, { encoding: 'utf-8' });
  } catch (err) {
    console.log(`[error] An error occurred while reading from ${source}`, err.message);
    process.exit(1);
  }
  content = content.split('\n');
  for (let line of content) {
    line = line.trim();
    if (!line) continue;
    const [topic, problem] = line.split(';');
    if (!topics.hasOwnProperty(topic)) {
      topics[topic] = [];
    }
    topics[topic].push(problem);
  }
  let markdownSource = '';
  markdownSource += '# Problems by topic\n\n'
  markdownSource += '- The original blog can be found at [this blog](https://codeforces.com/blog/entry/55274) on codeforces\n'
  markdownSource += '\n# Table of contents\n\n';
  let topicCount = 1;
  for (const topic in topics) {
    markdownSource += `- <a href="#${topicCount++}-${topic.toLowerCase()}">${topic} (${topics[topic].length})</a>\n`;
  }
  topicCount = 1 ;
  for (const topic in topics) {
    markdownSource += `\n## ${topicCount++}. ${topic}\n\n`;
    for (const problem of topics[topic]) {
      markdownSource += `- ${problem}\n`;
    }
    markdownSource += '\n<br>\n';
    markdownSource += `<p align="right"><a href="#table-of-contents">⬆ Jump to top</a></p>\n`
  }
  try {
    await fs.promises.writeFile(markdown, markdownSource, { encoding: 'utf-8' });
  } catch (err) {
    console.log(`[error] An error occurred while writing to ${markdown}`, err.message);
  }
}

(async () => {
  const problemsFile = 'problem-by-topics';
  const markdown = 'README.md';
  try {
    await fetchProblems(problemsFile);
    await renderMarkdown(problemsFile, markdown);
  } catch (err) {
    console.log(`[error] ${err.message}`);
  }
})();
