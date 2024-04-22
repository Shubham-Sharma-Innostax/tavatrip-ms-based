const getCurrencySymbolFromCode = async (currencyCode) => {
    try {
        const currencySymbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'INR': '₹',
            'AED': 'د.إ',
            'LKR': 'Rs',
        };

        const symbol = currencySymbols[currencyCode] || '';
        return symbol;
    } catch (error) {
        throw new Error('Error in retrieving currency symbol: ' + error.message);
    }
};

module.exports = { getCurrencySymbolFromCode}