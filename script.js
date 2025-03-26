let updateInterval;
        function formatMoney(amount) {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
            }).format(amount);
        }
        function updateMTM(data) {
            const mtmDisplay = document.getElementById('mtmDisplay');
            const mtmElement = document.getElementById('mtm');
            let mtmValue = parseFloat(data.mtm || 0);
            
            // Apply leverage if enabled
            if (isLeverageEnabled) {
                mtmValue *= leverageFactor;
            }
            
            mtmElement.textContent = formatMoney(mtmValue);
            mtmDisplay.className = `mtm-display ${mtmValue >= 0 ? 'profit' : 'loss'}`;
            mtmElement.className = `mtm-value ${mtmValue >= 0 ? 'positive' : 'negative'}`;
            
            document.getElementById('mtmUpdate').textContent = new Date().toLocaleTimeString();
        }
        function getProductLabel(product) {
            const productMap = {
                'I': 'INTRADAY',
                'D': 'DELIVERY',
                'CO': 'CO',
                'MTF': 'MTF'
            };
            return productMap[product] || 'NRML';
        }
        function updatePositions(positions) {
            const tbody = document.querySelector('#positionsTable tbody');
            if (!Array.isArray(positions) || positions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No active positions</td></tr>';
                document.getElementById('positionsCount').textContent = '0';
                return;
            }
            
            document.getElementById('positionsCount').innerHTML = `
                <i class="fas fa-layer-group"></i>${positions.length}
            `;

            // Sort positions by status and time
            const activePositions = positions.filter(p => p.status === 'ACTIVE')
                .sort((a, b) => new Date(b.entry_time || 0) - new Date(a.entry_time || 0));
                
            const closedPositions = positions.filter(p => p.status === 'CLOSED')
                .sort((a, b) => new Date(b.exit_time || 0) - new Date(a.exit_time || 0)); // Sort by exit time, newest first

            // Build HTML for positions table
            tbody.innerHTML = `
                ${activePositions.map(pos => createPositionRow(pos)).join('')}
                ${closedPositions.length > 0 ? `
                    <tr>
                        <td colspan="6" class="positions-divider">
                            <i class="fas fa-clock-rotate-left"></i>
                            Recently Closed (${closedPositions.length})
                        </td>
                    </tr>
                    ${closedPositions.map(pos => createPositionRow(pos)).join('')}
                ` : ''}
            `;

            // Update position counts and indicators
            document.getElementById('openCount').textContent = activePositions.length;
            document.getElementById('closedCount').textContent = closedPositions.length;
            
            // Update open indicator animation
            const openIndicator = document.getElementById('openIndicator');
            if (activePositions.length > 0) {
                openIndicator.classList.add('active');
            } else {
                openIndicator.classList.remove('active');
            }
        }

        // Helper function to create position row HTML
        function createPositionRow(pos) {
            if (!pos) return '';
            const data = {
                symbol: pos.trading_symbol || 'Unknown',
                product: pos.product || 'NRML',
                quantity: parseInt(pos.quantity) || 0,
                avgPrice: parseFloat(pos.average_price) || 0,
                ltp: parseFloat(pos.last_price) || 0,
                pnl: parseFloat(pos.unrealised) + parseFloat(pos.realised) || 0,
                status: pos.status || (parseInt(pos.quantity) === 0 ? 'CLOSED' : 'ACTIVE')
            };
            
            // Apply leverage if enabled
            const displayQuantity = isLeverageEnabled ? data.quantity * leverageFactor : data.quantity;
            const displayPnl = isLeverageEnabled ? data.pnl * leverageFactor : data.pnl;
            
            return `
                <tr class="position-row ${data.status === 'CLOSED' ? 'closed' : ''}">
                    <td>${data.symbol}</td>
                    <td><span class="product-type">${getProductLabel(data.product)}</span></td>
                    <td>${displayQuantity}</td>
                    <td>${formatMoney(data.avgPrice)}</td>
                    <td>${formatMoney(data.ltp)}</td>
                    <td class="${displayPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(displayPnl)}</td>
                </tr>
            `;
        }
        function updateOrders(orders) {
            const tbody = document.querySelector('#ordersTable tbody');
            if (!Array.isArray(orders) || orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No orders today</td></tr>';
                return;
            }
            
            // Get current filter state (open/completed)
            const showCompleted = document.getElementById('closedOrdersBtn').classList.contains('active');
            
            // Define completed statuses
            const completedStatuses = ['COMPLETE', 'REJECTED', 'CANCELLED', 'CANCELLED AMO'];
            
            // Filter orders based on status
            const filteredOrders = orders.filter(order => {
                const isCompleted = completedStatuses.includes(order.status);
                return showCompleted ? isCompleted : !isCompleted;
            });
            
            if (filteredOrders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7">No ${showCompleted ? 'completed' : 'open'} orders</td></tr>`;
                return;
            }

            // Count orders and update badges
            const openOrders = orders.filter(order => !completedStatuses.includes(order.status));
            const completedOrders = orders.filter(order => completedStatuses.includes(order.status));
            
            document.getElementById('openOrdersCount').textContent = openOrders.length;
            document.getElementById('completedOrdersCount').textContent = completedOrders.length;
            
            // Update blinking indicator
            const openOrdersDot = document.getElementById('openOrdersDot');
            if (openOrders.length > 0) {
                openOrdersDot.classList.add('active');
            } else {
                openOrdersDot.classList.remove('active');
            }

            tbody.innerHTML = filteredOrders.map(order => {
                if (!order) return '';
                
                const time = new Date(order.time).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
                
                const symbolName = (order.trading_symbol || 'Unknown').replace(/-EQ$/, '');
                const orderPrice = order.average_price || order.price || 0;
                
                // Apply leverage to quantity if enabled
                const displayQuantity = isLeverageEnabled ? order.quantity * leverageFactor : order.quantity;
                
                return `
                    <tr>
                        <td>${time}</td>
                        <td>${symbolName}</td>
                        <td>
                            <span class="order-type-${order.transaction_type?.toLowerCase()}">
                                ${order.transaction_type}
                            </span>
                        </td>
                        <td>${displayQuantity}</td>
                        <td>${formatMoney(orderPrice)}</td>
                        <td><span class="product-type">${getProductLabel(order.product)}</span></td>
                        <td>
                            <span class="status-badge ${order.status === 'REJECTED' ? 'status-rejected' : 
                                                      order.status === 'COMPLETE' ? 'status-complete' : 
                                                      'status-pending'}">
                                ${order.status}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Update the orders timestamp
            document.getElementById('ordersUpdate').textContent = new Date().toLocaleTimeString();
        }
        async function refreshData() {
            try {
                // First, try to refresh the token
                try {
                    const tokenRefresh = await fetch('/api/refresh_token');
                    const tokenData = await tokenRefresh.json();
                    console.log('Token refresh result:', tokenData);
                    // Wait a moment for the token to be properly updated
                    await new Promise(resolve => setTimeout(resolve, 500)); 
                } catch (tokenError) {
                    console.warn('Token refresh failed:', tokenError);
                    // Continue anyway, maybe the current token is still valid
                }
                
                // Now get the actual trading data
                const response = await fetch('/api/trading/data');
                const data = await response.json();
                console.log('API Response:', data); // Debug log
                if (data.status === 'success') {
                    if (data.data) {
                        updateMTM(data.data);
                        updatePositions(data.data.positions);
                        updateOrders(data.data.orders);
                    } else {
                        console.error('No data in response');
                    }
                } else {
                    console.error('Error fetching data:', data.message);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        function startAutoRefresh() {
            refreshData();
            updateInterval = setInterval(refreshData, 5000);
        }
        function stopAutoRefresh() {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        }
        // Remove redundant DOMContentLoaded listener
        // document.addEventListener('DOMContentLoaded', startAutoRefresh);
        // Stop updates when leaving page
        window.addEventListener('beforeunload', stopAutoRefresh);
        // Remove theme toggle functionality and keep only dark theme
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize tabs
            const positionsTab = document.getElementById('positionsTab');
            const ordersTab = document.getElementById('ordersTab');
            const positionsContent = document.getElementById('positionsContent');
            const ordersContent = document.getElementById('ordersContent');

            // Function to switch tabs
            function switchTab(activeTab, activeContent, inactiveTab, inactiveContent) {
                activeTab.classList.add('active');
                activeContent.classList.add('active');
                inactiveTab.classList.remove('active');
                inactiveContent.classList.remove('active');
            }

            // Event listeners for tab clicks
            positionsTab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(positionsTab, positionsContent, ordersTab, ordersContent);
            });

            ordersTab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(ordersTab, ordersContent, positionsTab, positionsContent);
            });

            // Tab switch for order filter buttons
            const openOrdersBtn = document.getElementById('openOrdersBtn');
            const closedOrdersBtn = document.getElementById('closedOrdersBtn');

            openOrdersBtn.addEventListener('click', () => {
                openOrdersBtn.classList.add('active');
                closedOrdersBtn.classList.remove('active');
                refreshData(); // Refresh to show open orders
            });

            closedOrdersBtn.addEventListener('click', () => {
                closedOrdersBtn.classList.add('active');
                openOrdersBtn.classList.remove('active');
                refreshData(); // Refresh to show completed orders
            });

            // Initialize leverage toggle
            const leverageToggle = document.getElementById('leverageToggle');
            const leverageIndicator = leverageToggle.querySelector('.leverage-indicator');
            
            // Check for saved leverage preference
            isLeverageEnabled = localStorage.getItem('leverageEnabled') === 'true';
            if (isLeverageEnabled) {
                leverageToggle.classList.add('active');
                leverageIndicator.textContent = leverageFactor + 'x';
            }
            
            // Add click event to leverage toggle
            leverageToggle.addEventListener('click', () => {
                isLeverageEnabled = !isLeverageEnabled;
                leverageToggle.classList.toggle('active', isLeverageEnabled);
                leverageIndicator.textContent = isLeverageEnabled ? leverageFactor + 'x' : '1x';
                localStorage.setItem('leverageEnabled', isLeverageEnabled);
                refreshData(); // Refresh to apply leverage factor
            });

            // Start data refresh
            startAutoRefresh();
        });
        function filterPositions(searchTerm) {
            const tbody = document.querySelector('#positionsTable tbody');
            const rows = tbody.getElementsByTagName('tr');
            searchTerm = searchTerm.toLowerCase();
            Array.from(rows).forEach(row => {
                const symbol = row.cells[0]?.textContent?.toLowerCase() || '';
                row.style.display = symbol.includes(searchTerm) ? '' : 'none';
            });
        }
        function filterOrders(searchTerm) {
            const tbody = document.querySelector('#ordersTable tbody');
            const rows = tbody.getElementsByTagName('tr');
            searchTerm = searchTerm.toLowerCase();
            Array.from(rows).forEach(row => {
                if (row.cells.length > 1) { // Skip rows with no data or loading message
                    const symbol = row.cells[1]?.textContent?.toLowerCase() || '';
                    row.style.display = symbol.includes(searchTerm) ? '' : 'none';
                }
            });
        }
        // Add event listener for the order type switch
        document.addEventListener('DOMContentLoaded', function() {
            const openOrdersBtn = document.getElementById('openOrdersBtn');
            const closedOrdersBtn = document.getElementById('closedOrdersBtn');
            // Ensure completed orders are shown by default
            refreshData();
            openOrdersBtn.addEventListener('click', async function() {
                openOrdersBtn.classList.add('active');
                closedOrdersBtn.classList.remove('active');
                await refreshData(); // Use await to ensure immediate update
            });
            closedOrdersBtn.addEventListener('click', async function() {
                closedOrdersBtn.classList.add('active');
                openOrdersBtn.classList.remove('active');
                await refreshData(); // Use await to ensure immediate update
            });
        });
        // Add mobile-specific class to less important table columns
        document.addEventListener('DOMContentLoaded', function() {
            // Detect mobile view
            function isMobileView() {
                return window.innerWidth <= 768;
            }
            // Optimize table display for mobile view
            function optimizeForMobile() {
                // Add any additional mobile optimizations that can't be done with CSS alone
                if (isMobileView()) {
                    // Add fastclick to eliminate the 300ms delay on touch devices
                    document.body.classList.add('mobile-view');
                    // Make table rows more tappable (adds an effect when touched)
                    const rows = document.querySelectorAll('.position-row, #ordersTable tbody tr');
                    rows.forEach(row => {
                        row.addEventListener('touchstart', function() {
                            this.classList.add('row-touched');
                        });
                        row.addEventListener('touchend', function() {
                            this.classList.remove('row-touched');
                        });
                    });
                } else {
                    document.body.classList.remove('mobile-view');
                }
            }
            // Initial optimization
            optimizeForMobile();
            // Re-optimize when window is resized
            window.addEventListener('resize', optimizeForMobile);
            // Enhance scrolling performance on mobile
            if (isMobileView()) {
                // Use passive event listeners for better scroll performance
                document.querySelectorAll('.card').forEach(card => {
                    card.addEventListener('touchstart', function(){}, {passive: true});
                    card.addEventListener('touchmove', function(){}, {passive: true});
                });
            }
        });
        // Scanner Functions - Replace the old scanStocks function with this updated version
        async function scanStocks() {
            try {
                const loadingIndicator = document.getElementById('scannerLoading');
                const scanBtn = document.getElementById('scanBtn');
                const drawer = document.getElementById('scannerDrawer');
                const overlay = document.getElementById('scannerOverlay');
                
                // Ensure drawer stays open
                drawer.classList.add('open');
                overlay.classList.add('open');
                
                // Show loading indicator
                loadingIndicator.classList.add('active');
                scanBtn.disabled = true;
                
                // Update table to loading state
                const tbody = document.querySelector('#scannerTable tbody');
                tbody.innerHTML = '<tr><td colspan="7">Scanning market for opportunities...</td></tr>';

                try {
                    const response = await fetch('/api/scan', {
                        timeout: 30000
                    });

                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    if (data.status === 'success' && Array.isArray(data.stocks)) {
                        displayScannerResults(data.stocks);
                        showNotification(
                            'success',
                            'Scan Complete',
                            `Found ${data.stocks.length} stocks matching criteria`
                        );
                    } else {
                        tbody.innerHTML = '<tr><td colspan="7">No stocks found</td></tr>';
                        document.getElementById('scannerCount').innerHTML = `
                            <i class="fas fa-search"></i>0
                        `;
                    }
                } catch (error) {
                    console.error('Scan request error:', error);
                    tbody.innerHTML = '<tr><td colspan="7">Error: Failed to scan stocks</td></tr>';
                    showNotification(
                        'error',
                        'Scan Error',
                        error.message || 'Failed to scan stocks'
                    );
                }
            } catch (error) {
                console.error('Scanner error:', error);
                showNotification(
                    'error',
                    'Scanner Error',
                    error.message || 'Failed to scan stocks'
                );
            } finally {
                // Hide loading indicator and re-enable scan button
                document.getElementById('scannerLoading').classList.remove('active');
                document.getElementById('scanBtn').disabled = false;
                
                // Make sure drawer stays open after scan completes
                document.getElementById('scannerDrawer').classList.add('open');
                document.getElementById('scannerOverlay').classList.add('open');
            }
        }

        function displayScannerResults(stocks) {
            const tbody = document.querySelector('#scannerTable tbody');
            if (!Array.isArray(stocks)) {
                console.error('Invalid stocks data:', stocks);
                return;
            }

            // Filter stocks with gap > 2%
            const filteredStocks = stocks.filter(stock => parseFloat(stock.change) > 2);

            document.getElementById('scannerCount').innerHTML = `
                <i class="fas fa-search"></i>
                ${filteredStocks.length}
            `;

            if (filteredStocks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No stocks found matching criteria</td></tr>';
                return;
            }

            tbody.innerHTML = filteredStocks.map((stock, index) => {
                const isTrending = parseFloat(stock.change) >= 3;
                
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${stock.symbol}
                            ${isTrending ? 
                              '<span class="trending-indicator"><i class="fas fa-fire"></i>Trending</span>' : 
                              ''}
                        </td>
                        <td>${stock.name || ''}</td>
                        <td><span class="product-type">${stock.source || ''}</span></td>
                        <td>${formatMoney(stock.open)}</td>
                        <td class="gap-positive">+${parseFloat(stock.change).toFixed(2)}%</td>
                        <td>
                            <div class="trade-actions">
                                <button 
                                    class="buy-btn"
                                    onclick="placeScannerOrder('${stock.instrument_key}', 'BUY')"
                                    style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;">
                                    BUY
                                </button>
                                <button 
                                    class="sell-btn"
                                    onclick="placeScannerOrder('${stock.instrument_key}', 'SELL')"
                                    style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer;">
                                    SELL
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Add event listener to load stored results when page loads
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                // Load stored scanner results
                const storedResponse = await fetch('/api/scanner/stored');
                const storedData = await storedResponse.json();
                if (storedData.status === 'success' && storedData.data.stocks) {
                    displayScannerResults(storedData.data.stocks);
                    
                    // Show last scan time if available
                    if (storedData.data.last_scan) {
                        const scanTime = new Date(storedData.data.last_scan);
                        const formattedTime = scanTime.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                        
                        showNotification(
                            'info',
                            'Scanner Results Loaded',
                            `Showing last scan from ${formattedTime}`
                        );
                    }
                }
            } catch (error) {
                console.error('Error loading stored results:', error);
            }
        });

        async function placeScannerOrder(instrumentKey, transactionType) {
            try {
                console.log('Starting placeScannerOrder with:', instrumentKey, transactionType);
                
                // STEP 1: Get stock info from table
                const rows = document.querySelectorAll('#scannerTable tbody tr');
                const stockRow = Array.from(rows).find(row => {
                    const symbol = row.children[1].textContent.trim().split('\n')[0].trim();
                    const fullKey = `NSE_EQ|${symbol}`;
                    return fullKey === instrumentKey;
                });

                if (!stockRow) {
                    throw new Error('Could not find stock in the table');
                }

                const symbol = stockRow.children[1].textContent.trim().split('\n')[0].trim();
                console.log('Found stock in table:', symbol);

                // STEP 2: Get real-time price from API instead of using table price
                console.log('Fetching real-time price instead of using table price...');
                
                // Make API call to get real-time quote
                const quoteResponse = await fetch('/api/scanner/quotes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        symbols: [`NSE_EQ|${symbol}`]
                    })
                });
                
                const quoteData = await quoteResponse.json();
                console.log('Quote API response:', quoteData);
                
                // Extract price from quote data
                let stockPrice;
                if (quoteData.status === 'success' && quoteData.data && quoteData.data[symbol]) {
                    stockPrice = quoteData.data[symbol].last_price;
                    console.log(`Using real-time price: ₹${stockPrice} (from API)`);
                } else {
                    // Fall back to table price if API fails
                    const priceText = stockRow.children[4].textContent.trim();
                    stockPrice = parseFloat(priceText.replace(/[₹,]/g, ''));
                    console.log(`Using table price: ₹${stockPrice} (fallback)`);
                }
                
                if (isNaN(stockPrice) || stockPrice <= 0) {
                    throw new Error('Invalid stock price');
                }
                
                // STEP 3: Get settings from localStorage
                const settings = JSON.parse(localStorage.getItem('tradeSettings')) || { maxCapital: 50000 };
                const maxCapital = settings.maxCapital || 50000;
                
                console.log('Trade settings from localStorage:', settings);
                console.log('Using maxCapital:', maxCapital);
                
                // STEP 4: Calculate quantity with safety buffer
                const safetyFactor = 0.95; // Use 95% of max capital as we now have accurate price
                const effectiveMaxCapital = maxCapital * safetyFactor;
                let quantity = Math.floor(effectiveMaxCapital / stockPrice);
                
                if (quantity <= 0) {
                    throw new Error(`Stock price ₹${stockPrice.toLocaleString()} exceeds max capital ₹${maxCapital.toLocaleString()}`);
                }
                
                const totalValue = quantity * stockPrice;
                console.log(`Calculated quantity: ${quantity}, total value: ₹${totalValue.toLocaleString()}`);
                console.log(`Used effective max capital: ₹${effectiveMaxCapital.toLocaleString()} (${safetyFactor * 100}% of ₹${maxCapital.toLocaleString()})`);
                
                // STEP 5: Make the API call
                console.log(`Placing ${transactionType} order for ${quantity} shares of ${symbol}`);
                
                const payload = {
                    instrument_key: instrumentKey,
                    transaction_type: transactionType,
                    quantity: quantity,
                    maxCapital: maxCapital  // Using original maxCapital in the API call
                };
                
                console.log('Sending payload to API:', payload);
                
                const response = await fetch('/api/scanner/trade', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                console.log('API response:', data);

                if (data.status === 'success') {
                    showNotification(
                        transactionType === 'SELL' ? 'error' : 'success',
                        'Order Placed Successfully',
                        `${transactionType} order placed for ${quantity} shares (₹${totalValue.toLocaleString()})`
                    );
                    refreshData(); // Refresh trading data after order
                } else {
                    showNotification(
                        'error',
                        'Order Failed',
                        data.message || 'Failed to place order'
                    );
                }
            } catch (error) {
                console.error('Order error:', error);
                showNotification(
                    'error',
                    'Order Error',
                    error.message || 'Failed to place order'
                );
            }
        }

        // Add notification system
        function showNotification(type, title, message) {
            const container = document.getElementById('notificationContainer');
            
            // Remove any existing notifications
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            let iconClass = 'check-circle';
            if (type === 'error') iconClass = 'exclamation-circle';
            if (type === 'warning') iconClass = 'exclamation-triangle';
            if (type === 'info') iconClass = 'info-circle';
            
            notification.innerHTML = `
                <i class="fas fa-${iconClass} notification-icon"></i>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
            `;
            
            container.appendChild(notification);
            
            // Force reflow
            notification.offsetHeight;
            
            requestAnimationFrame(() => {
                notification.classList.add('show');
            });
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }

        // Update the CSS for loading spinner
        function addSpinnerStyles() {
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .loading-row {
                    text-align: center;
                    color: #a0a0a0;
                    padding: 40px !important;
                }
                
                .loading-row i {
                    margin-right: 8px;
                    animation: spin 1s linear infinite;
                    color: #a277ff;
                    font-size: 18px;
                }
            `;
            document.head.appendChild(style);
        }

        // Add this to your DOMContentLoaded event
        document.addEventListener('DOMContentLoaded', function() {
            // ...existing code...
            addSpinnerStyles();
        });

        // Add new function for loading overlay visibility
        function toggleLoadingOverlay(show) {
            const loadingOverlay = document.querySelector('.loading-overlay');
            if (!loadingOverlay) {
                // Create loading overlay if it doesn't exist
                const overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-content">
                        <i class="fas fa-spinner fa-spin loading-spinner"></i>
                        <span class="loading-text">Scanning stocks...</span>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
            document.querySelector('.loading-overlay').style.display = show ? 'flex' : 'none';
        }

        // Add loading overlay CSS after existing CSS rules
        const style = document.createElement('style');
        style.textContent = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }

            .loading-content {
                background: rgba(45, 45, 65, 0.95);
                padding: 20px 30px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 15px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .loading-spinner {
                color: #a277ff;
                font-size: 24px;
                animation: spin 1s linear infinite;
            }

            .loading-text {
                color: #fff;
                font-size: 16px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        // Add these functions for trade settings
        function showTradeSettingsPopup() {
            document.getElementById('tradeSettingsPopup').style.display = 'flex';
        }

        function hideTradeSettingsPopup() {
            document.getElementById('tradeSettingsPopup').style.display = 'none';
        }

        // REPLACE both DOMContentLoaded event listeners with a single one that handles everything
        document.addEventListener('DOMContentLoaded', function() {
            // Load and verify trade settings
            let maxCapitalValue = 50000; // Default value
            
            try {
                const rawSettings = localStorage.getItem('tradeSettings');
                console.log('Raw trade settings on page load:', rawSettings);
                
                if (rawSettings) {
                    const parsed = JSON.parse(rawSettings);
                    if (parsed && parsed.maxCapital) {
                        maxCapitalValue = parseInt(parsed.maxCapital);
                        if (isNaN(maxCapitalValue) || maxCapitalValue <= 0) {
                            console.warn('Invalid maxCapital value in settings, using default');
                            maxCapitalValue = 50000;
                        }
                    }
                }
            } catch (e) {
                console.error('Error loading initial trade settings:', e);
            }
            
            // Set the value in the input field
            const maxCapitalInput = document.getElementById('maxCapital');
            if (maxCapitalInput) {
                maxCapitalInput.value = maxCapitalValue;
                console.log('Trade settings initialized with maxCapital:', maxCapitalValue);
            }
            
            // Log the current state of localStorage for debugging
            console.log('Current localStorage state:');
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                console.log(`${key}: ${localStorage.getItem(key)}`);
            }
            
            // Set up event handlers for the trade settings popup
            const showTradeSettingsBtn = document.getElementById('showTradeSettings');
            if (showTradeSettingsBtn) {
                showTradeSettingsBtn.addEventListener('click', function() {
                    document.getElementById('tradeSettingsPopup').style.display = 'flex';
                });
            }
            
            const hideTradeSettingsBtn = document.getElementById('hideTradeSettings');
            if (hideTradeSettingsBtn) {
                hideTradeSettingsBtn.addEventListener('click', function() {
                    document.getElementById('tradeSettingsPopup').style.display = 'none';
                });
            }
            
            const saveTradeSettingsBtn = document.getElementById('saveTradeSettings');
            if (saveTradeSettingsBtn) {
                saveTradeSettingsBtn.addEventListener('click', function() {
                    const inputValue = document.getElementById('maxCapital').value.trim();
                    const maxCapital = parseInt(inputValue);
                    
                    if (isNaN(maxCapital) || maxCapital <= 0) {
                        showNotification('error', 'Invalid Input', 'Please enter a valid amount');
                        return;
                    }
                    
                    // Create settings object with numeric value
                    const settings = { maxCapital: maxCapital };
                    
                    // Convert to JSON and save to localStorage
                    const settingsJson = JSON.stringify(settings);
                    localStorage.setItem('tradeSettings', settingsJson);
                    
                    console.log('Trade settings saved:', settings);
                    console.log('JSON saved to localStorage:', settingsJson);
                    
                    // Show confirmation to user with formatted value
                    showNotification(
                        'success',
                        'Settings Saved',
                        `Maximum capital per stock set to ₹${maxCapital.toLocaleString()}`
                    );
                    
                    document.getElementById('tradeSettingsPopup').style.display = 'none';
                });
            }
        });

        // Add function to update scanner prices in real-time
        function updateScannerPrices() {
            console.log('Starting price update...');
            const rows = document.querySelectorAll('#scannerTable tbody tr');
            if (rows.length === 0) {
                console.log('No rows found, skipping update');
                return;
            }
            
            // First ensure all price cells have the proper structure
            rows.forEach(row => {
                const priceCell = row.children[4];
                if (!priceCell) return;
                
                // If the price cell doesn't have our special structure, create it
                if (!priceCell.querySelector('.price-value')) {
                    // Save the current price text if it exists
                    const currentPrice = priceCell.textContent.trim();
                    
                    // Create a stable structure for the price that won't change during updates
                    priceCell.innerHTML = `<span class="price-value">${currentPrice}</span>`;
                    
                    // Ensure the cell has the right CSS
                    priceCell.style.position = 'relative';
                    priceCell.style.minWidth = '120px';
                }
            });
            
            // Collect symbols from the table
            const symbols = [];
            rows.forEach(row => {
                const symbol = row.children[1]?.textContent.trim().split('\n')[0].trim();
                if (symbol) {
                    symbols.push(`NSE_EQ|${symbol}`);
                }
            });
            
            if (symbols.length === 0) {
                console.log('No symbols found, skipping update');
                return;
            }
            
            // Make API call to get real-time quotes
            console.log(`Fetching prices for ${symbols.length} symbols...`);
            fetch('/api/scanner/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ symbols: symbols })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.data) {
                    console.log('Received price data successfully');
                    
                    // Update prices in the table
                    rows.forEach(row => {
                        try {
                            // Get symbol
                            const symbol = row.children[1]?.textContent.trim().split('\n')[0].trim();
                            if (!symbol || !data.data[symbol]) return;
                            
                            // Get price cell and value element
                            const priceCell = row.children[4];
                            if (!priceCell) return;
                            
                            const priceValueElement = priceCell.querySelector('.price-value');
                            if (!priceValueElement) return;
                            
                            // Get new price from API data
                            const newPrice = data.data[symbol].last_price;
                            if (!newPrice || isNaN(newPrice) || newPrice <= 0) return;
                            
                            // Parse current price
                            const currentPriceText = priceValueElement.textContent.trim();
                            let oldPrice = 0;
                            if (currentPriceText) {
                                try {
                                    oldPrice = parseFloat(currentPriceText.replace(/[₹,]/g, ''));
                                } catch (e) {
                                    oldPrice = 0;
                                }
                            }
                            
                            // Format new price
                            const formattedPrice = `₹${parseFloat(newPrice).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}`;
                            
                            // Update just the price text
                            priceValueElement.textContent = formattedPrice;
                            
                            // Show color indicators for price change
                            if (oldPrice > 0) {
                                if (newPrice > oldPrice) {
                                    priceCell.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                                    setTimeout(() => {
                                        priceCell.style.backgroundColor = '';
                                    }, 2000);
                                } else if (newPrice < oldPrice) {
                                    priceCell.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    setTimeout(() => {
                                        priceCell.style.backgroundColor = '';
                                    }, 2000);
                                }
                            }
                        } catch (error) {
                            console.error('Error updating price for a row:', error);
                        }
                    });
                    
                    console.log('Price update completed successfully');
                } else {
                    console.warn('Received response but no valid data');
                }
            })
            .catch(error => {
                console.error('Failed to fetch prices:', error);
            });
        }

        // Change the update frequency
        document.addEventListener('DOMContentLoaded', function() {
            // Only set up the price updates if scanner table exists
            if (document.getElementById('scannerTable')) {
                // First update after 5 seconds (let the page fully load)
                setTimeout(() => {
                    console.log('Initial price update');
                    updateScannerPrices();
                }, 5000);
                
                // Then update every 45 seconds (less frequent updates)
                const updateInterval = setInterval(updateScannerPrices, 45000);
                console.log('Price update interval set');
            }
        });

        // Add these new scanner drawer functions
        document.addEventListener('DOMContentLoaded', function() {
            const drawer = document.getElementById('scannerDrawer');
            const overlay = document.getElementById('scannerOverlay');
            const showButton = document.getElementById('showScanner');
            const closeButton = document.getElementById('closeScanner');
            const handle = document.getElementById('scannerHandle');

            function openDrawer() {
                drawer.classList.add('open');
                overlay.classList.add('open');
                document.body.style.overflow = 'hidden';
            }

            function closeDrawer() {
                drawer.classList.remove('open');
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }

            showButton.addEventListener('click', openDrawer);
            closeButton.addEventListener('click', closeDrawer);
            handle.addEventListener('click', closeDrawer);
            
            overlay.addEventListener('click', closeDrawer);

            // Add touch support for mobile
            let startY = 0;
            let currentY = 0;

            handle.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                currentY = startY;
            });

            handle.addEventListener('touchmove', (e) => {
                currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                if (diff > 0) { // Only allow downward drag
                    drawer.style.transform = `translateY(${diff}px)`;
                }
            });

            handle.addEventListener('touchend', () => {
                const diff = currentY - startY;
                if (diff > 100) { // If dragged down more than 100px, close
                    closeDrawer();
                } else {
                    drawer.style.transform = '';
                }
            });

            // Prevent drawer content from triggering drawer close
            drawer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        // Update scanStocks function to work with the drawer
        async function scanStocks() {
            try {
                const loadingIndicator = document.getElementById('scannerLoading');
                const scanBtn = document.getElementById('scanBtn');
                const drawer = document.getElementById('scannerDrawer');
                const overlay = document.getElementById('scannerOverlay');
                
                // Ensure drawer stays open
                drawer.classList.add('open');
                overlay.classList.add('open');
                
                // Show loading indicator
                loadingIndicator.classList.add('active');
                scanBtn.disabled = true;
                
                // Update table to loading state
                const tbody = document.querySelector('#scannerTable tbody');
                tbody.innerHTML = '<tr><td colspan="7">Scanning market for opportunities...</td></tr>';

                try {
                    const response = await fetch('/api/scan', {
                        timeout: 30000
                    });

                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    if (data.status === 'success' && Array.isArray(data.stocks)) {
                        displayScannerResults(data.stocks);
                        showNotification(
                            'success',
                            'Scan Complete',
                            `Found ${data.stocks.length} stocks matching criteria`
                        );
                    } else {
                        tbody.innerHTML = '<tr><td colspan="7">No stocks found</td></tr>';
                        document.getElementById('scannerCount').innerHTML = `
                            <i class="fas fa-search"></i>0
                        `;
                    }
                } catch (error) {
                    console.error('Scan request error:', error);
                    tbody.innerHTML = '<tr><td colspan="7">Error: Failed to scan stocks</td></tr>';
                    showNotification(
                        'error',
                        'Scan Error',
                        error.message || 'Failed to scan stocks'
                    );
                }
            } catch (error) {
                console.error('Scanner error:', error);
                showNotification(
                    'error',
                    'Scanner Error',
                    error.message || 'Failed to scan stocks'
                );
            } finally {
                // Hide loading indicator and re-enable scan button
                document.getElementById('scannerLoading').classList.remove('active');
                document.getElementById('scanBtn').disabled = false;
                
                // Make sure drawer stays open after scan completes
                document.getElementById('scannerDrawer').classList.add('open');
                document.getElementById('scannerOverlay').classList.add('open');
            }
        }

        // Add new leverage-related functions
        let isLeverageEnabled = false;
        let leverageFactor = 5; // Default leverage factor

        function toggleLeverage() {
            isLeverageEnabled = !isLeverageEnabled;
            const button = document.getElementById('leverageToggle');
            button.classList.toggle('active');
            
            // Update indicator
            const indicator = button.querySelector('.leverage-indicator');
            indicator.textContent = isLeverageEnabled ? `${leverageFactor}x` : '1x';
            
            // Refresh data to update displays
            refreshData();
        }

        // Modify the existing updateMTM function
        function updateMTM(data) {
            const mtmDisplay = document.getElementById('mtmDisplay');
            const mtmElement = document.getElementById('mtm');
            let mtmValue = parseFloat(data.mtm || 0);
            
            // Apply leverage if enabled
            if (isLeverageEnabled) {
                mtmValue *= leverageFactor;
            }
            
            mtmElement.textContent = formatMoney(mtmValue);
            mtmDisplay.className = `mtm-display ${mtmValue >= 0 ? 'profit' : 'loss'}`;
            mtmElement.className = `mtm-value ${mtmValue >= 0 ? 'positive' : 'negative'}`;
            
            document.getElementById('mtmUpdate').textContent = new Date().toLocaleTimeString();
        }

        // Modify the existing updatePositions function
        function updatePositions(positions) {
            const tbody = document.querySelector('#positionsTable tbody');
            if (!Array.isArray(positions) || positions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6">No active positions</td></tr>';
                document.getElementById('positionsCount').textContent = '0';
                return;
            }
            document.getElementById('positionsCount').innerHTML = `
                <i class="fas fa-layer-group"></i>${positions.length}
            `;

            // Sort positions by status and time
            const activePositions = positions.filter(p => p.status === 'ACTIVE')
                .sort((a, b) => new Date(b.entry_time || 0) - new Date(a.entry_time || 0));
                
            const closedPositions = positions.filter(p => p.status === 'CLOSED')
                .sort((a, b) => new Date(b.exit_time || 0) - new Date(a.exit_time || 0)); // Sort by exit time, newest first

            // Build HTML for positions table
            tbody.innerHTML = `
                ${activePositions.map(pos => createPositionRow(pos)).join('')}
                ${closedPositions.length > 0 ? `
                    <tr>
                        <td colspan="6" class="positions-divider">
                            <i class="fas fa-clock-rotate-left"></i>
                            Recently Closed (${closedPositions.length})
                        </td>
                    </tr>
                    ${closedPositions.map(pos => createPositionRow(pos)).join('')}
                ` : ''}
            `;

            // Update position counts and indicators
            document.getElementById('openCount').textContent = activePositions.length;
            document.getElementById('closedCount').textContent = closedPositions.length;
            
            // Update open indicator animation
            const openIndicator = document.getElementById('openIndicator');
            if (activePositions.length > 0) {
                openIndicator.classList.add('active');
            } else {
                openIndicator.classList.remove('active');
            }
        }

        // Helper function to create position row HTML
        function createPositionRow(pos) {
            if (!pos) return '';
            const data = {
                symbol: pos.trading_symbol || 'Unknown',
                product: pos.product || 'NRML',
                quantity: parseInt(pos.quantity) || 0,
                avgPrice: parseFloat(pos.average_price) || 0,
                ltp: parseFloat(pos.last_price) || 0,
                pnl: parseFloat(pos.unrealised) + parseFloat(pos.realised) || 0,
                status: pos.status || (parseInt(pos.quantity) === 0 ? 'CLOSED' : 'ACTIVE')
            };
            
            // Apply leverage if enabled
            const displayQuantity = isLeverageEnabled ? data.quantity * leverageFactor : data.quantity;
            const displayPnl = isLeverageEnabled ? data.pnl * leverageFactor : data.pnl;
            
            return `
                <tr class="position-row ${data.status === 'CLOSED' ? 'closed' : ''}">
                    <td>${data.symbol}</td>
                    <td><span class="product-type">${getProductLabel(data.product)}</span></td>
                    <td>${displayQuantity}</td>
                    <td>${formatMoney(data.avgPrice)}</td>
                    <td>${formatMoney(data.ltp)}</td>
                    <td class="${displayPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(displayPnl)}</td>
                </tr>
            `;
        }

        // Modify the DOMContentLoaded event listener
        document.addEventListener('DOMContentLoaded', function() {
            // Load and verify trade settings
            let maxCapitalValue = 50000; // Default value
            
            try {
                const rawSettings = localStorage.getItem('tradeSettings');
                console.log('Raw trade settings on page load:', rawSettings);
                
                if (rawSettings) {
                    const parsed = JSON.parse(rawSettings);
                    if (parsed && parsed.maxCapital) {
                        maxCapitalValue = parseInt(parsed.maxCapital);
                        if (isNaN(maxCapitalValue) || maxCapitalValue <= 0) {
                            console.warn('Invalid maxCapital value in settings, using default');
                            maxCapitalValue = 50000;
                        }
                    }
                }
            } catch (e) {
                console.error('Error loading initial trade settings:', e);
            }
            
            // Set the value in the input field
            const maxCapitalInput = document.getElementById('maxCapital');
            if (maxCapitalInput) {
                maxCapitalInput.value = maxCapitalValue;
                console.log('Trade settings initialized with maxCapital:', maxCapitalValue);
            }
            
            // Log the current state of localStorage for debugging
            console.log('Current localStorage state:');
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                console.log(`${key}: ${localStorage.getItem(key)}`);
            }
            
            // Set up event handlers for the trade settings popup
            const showTradeSettingsBtn = document.getElementById('showTradeSettings');
            if (showTradeSettingsBtn) {
                showTradeSettingsBtn.addEventListener('click', function() {
                    document.getElementById('tradeSettingsPopup').style.display = 'flex';
                });
            }
            
            const hideTradeSettingsBtn = document.getElementById('hideTradeSettings');
            if (hideTradeSettingsBtn) {
                hideTradeSettingsBtn.addEventListener('click', function() {
                    document.getElementById('tradeSettingsPopup').style.display = 'none';
                });
            }
            
            const saveTradeSettingsBtn = document.getElementById('saveTradeSettings');
            if (saveTradeSettingsBtn) {
                saveTradeSettingsBtn.addEventListener('click', function() {
                    const inputValue = document.getElementById('maxCapital').value.trim();
                    const maxCapital = parseInt(inputValue);
                    const newLeverageFactor = parseInt(document.getElementById('leverageFactor').value);
                    
                    if (isNaN(maxCapital) || maxCapital <= 0) {
                        showNotification('error', 'Invalid Input', 'Please enter a valid amount');
                        return;
                    }
                    
                    if (isNaN(newLeverageFactor) || newLeverageFactor < 1) {
                        showNotification('error', 'Invalid Input', 'Please enter a valid leverage factor');
                        return;
                    }
                    
                    const settings = { 
                        maxCapital: maxCapital,
                        leverageFactor: newLeverageFactor
                    };
                    
                    localStorage.setItem('tradeSettings', JSON.stringify(settings));
                    leverageFactor = newLeverageFactor;
                    
                    showNotification(
                        'success',
                        'Settings Saved',
                        `Maximum capital: ₹${maxCapital.toLocaleString()}, Leverage: ${newLeverageFactor}x`
                    );
                    
                    document.getElementById('tradeSettingsPopup').style.display = 'none';
                    
                    // Update leverage indicator if leverage is enabled
                    if (isLeverageEnabled) {
                        document.querySelector('.leverage-indicator').textContent = `${newLeverageFactor}x`;
                    }
                    
                    // Refresh data to update displays with new leverage
                    refreshData();
                });
            }

            // Add leverage toggle handler
            const leverageToggle = document.getElementById('leverageToggle');
            leverageToggle.addEventListener('click', toggleLeverage);
            
            // Load leverage settings
            try {
                const settings = JSON.parse(localStorage.getItem('tradeSettings')) || {};
                leverageFactor = settings.leverageFactor || 5;
                document.getElementById('leverageFactor').value = leverageFactor;
            } catch (e) {
                console.error('Error loading leverage settings:', e);
            }
        });

        // Tab functionality
        document.addEventListener('DOMContentLoaded', () => {
            const positionsTab = document.getElementById('positionsTab');
            const ordersTab = document.getElementById('ordersTab');
            const positionsContent = document.getElementById('positionsContent');
            const ordersContent = document.getElementById('ordersContent');

            // Function to switch tabs
            function switchTab(activeTab, activeContent, inactiveTab, inactiveContent) {
                activeTab.classList.add('active');
                activeContent.classList.add('active');
                inactiveTab.classList.remove('active');
                inactiveContent.classList.remove('active');
            }

            // Event listeners for tab clicks
            positionsTab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(positionsTab, positionsContent, ordersTab, ordersContent);
            });

            ordersTab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(ordersTab, ordersContent, positionsTab, positionsContent);
            });

            // Tab switch for order filter buttons
            const openOrdersBtn = document.getElementById('openOrdersBtn');
            const closedOrdersBtn = document.getElementById('closedOrdersBtn');

            openOrdersBtn.addEventListener('click', () => {
                openOrdersBtn.classList.add('active');
                closedOrdersBtn.classList.remove('active');
                refreshData(); // Refresh to show open orders
            });

            closedOrdersBtn.addEventListener('click', () => {
                closedOrdersBtn.classList.add('active');
                openOrdersBtn.classList.remove('active');
                refreshData(); // Refresh to show completed orders
            });

            // Initialize leverage toggle
            const leverageToggle = document.getElementById('leverageToggle');
            const leverageIndicator = leverageToggle.querySelector('.leverage-indicator');
            
            // Check for saved leverage preference
            isLeverageEnabled = localStorage.getItem('leverageEnabled') === 'true';
            if (isLeverageEnabled) {
                leverageToggle.classList.add('active');
                leverageIndicator.textContent = leverageFactor + 'x';
            }
            
            // Add click event to leverage toggle
            leverageToggle.addEventListener('click', () => {
                isLeverageEnabled = !isLeverageEnabled;
                leverageToggle.classList.toggle('active', isLeverageEnabled);
                leverageIndicator.textContent = isLeverageEnabled ? leverageFactor + 'x' : '1x';
                localStorage.setItem('leverageEnabled', isLeverageEnabled);
                refreshData(); // Refresh to apply leverage factor
            });

            // Start data refresh
            startAutoRefresh();
        });

        // Stop updates when leaving page
        window.addEventListener('beforeunload', stopAutoRefresh);

        document.addEventListener('DOMContentLoaded', () => {
            const themeToggle = document.getElementById('themeToggle');
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.classList.add(savedTheme + '-mode');
            themeToggle.innerHTML = savedTheme === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

            themeToggle.addEventListener('click', () => {
                const isLightMode = document.body.classList.toggle('light-mode');
                document.body.classList.toggle('dark-mode', !isLightMode);
                themeToggle.innerHTML = isLightMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
                localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
            });
        });