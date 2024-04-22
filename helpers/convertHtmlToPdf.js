const puppeteer = require('puppeteer')

const convertHtmlToPdf = async (htmlContent, outputPath) => {
	const browser = await puppeteer.launch()
	const page = await browser.newPage()

	// Set content to the HTML provided
	await page.setContent(htmlContent)

	// Generate PDF from the HTML content
	await page.pdf({ path: outputPath, format: 'A4' })

	// Close the browser
	await browser.close()
}

module.exports = { convertHtmlToPdf }
