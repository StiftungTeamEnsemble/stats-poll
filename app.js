class CSVStatsVisualizer {
    constructor() {
        this.csvData = null;
        this.chart = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const columnSelect = document.getElementById('columnSelect');

        // Drop zone events
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('drop', this.handleDrop.bind(this));

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // Column selection change
        columnSelect.addEventListener('change', this.handleColumnChange.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'text/csv') {
            this.handleFileSelect(file);
        }
    }

    handleFileSelect(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseCSV(e.target.result);
        };
        reader.readAsText(file);
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        this.csvData = { headers, data };
        this.populateColumnSelect();
        this.showControls();
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    isNumericColumn(columnName) {
        if (!this.csvData) return false;
        
        const values = this.csvData.data
            .map(row => row[columnName])
            .filter(val => val !== '' && val !== '-' && val !== null && val !== undefined);
        
        if (values.length === 0) return false;

        // Check if at least 80% of non-empty values are numeric
        const numericCount = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val)).length;
        return numericCount / values.length >= 0.8;
    }

    populateColumnSelect() {
        const select = document.getElementById('columnSelect');
        select.innerHTML = '<option value="">Choose a numeric column...</option>';

        this.csvData.headers.forEach(header => {
            if (this.isNumericColumn(header)) {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            }
        });
    }

    showControls() {
        document.getElementById('controlsSection').style.display = 'block';
    }

    handleColumnChange(e) {
        const columnName = e.target.value;
        if (columnName) {
            this.renderChart(columnName);
        } else {
            this.hideChart();
        }
    }

    getNumericValues(columnName) {
        return this.csvData.data
            .map(row => parseFloat(row[columnName]))
            .filter(val => !isNaN(val) && isFinite(val));
    }

    calculateStats(values) {
        if (values.length === 0) return { average: 0, median: 0 };

        const sum = values.reduce((acc, val) => acc + val, 0);
        const average = sum / values.length;

        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return { average, median };
    }

    getDistribution(values) {
        const distribution = {};
        values.forEach(val => {
            distribution[val] = (distribution[val] || 0) + 1;
        });
        return distribution;
    }

    renderChart(columnName) {
        const values = this.getNumericValues(columnName);
        const stats = this.calculateStats(values);
        const distribution = this.getDistribution(values);

        // Update title and stats
        document.getElementById('chartTitle').textContent = columnName;
        document.getElementById('averageValue').textContent = stats.average.toFixed(2);
        document.getElementById('medianValue').textContent = stats.median.toFixed(2);

        // Prepare chart data
        const sortedKeys = Object.keys(distribution).sort((a, b) => parseFloat(a) - parseFloat(b));
        const chartData = {
            labels: sortedKeys,
            datasets: [{
                label: 'Count',
                data: sortedKeys.map(key => distribution[key]),
                backgroundColor: 'rgba(0, 140, 230, 0.6)', // cyan with opacity
                borderColor: '#008ce6', // cyan
                borderWidth: 2
            }]
        };

        // Custom plugin for vertical lines
        const verticalLinesPlugin = {
            id: 'verticalLines',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const xScale = chart.scales.x;
                const yScale = chart.scales.y;

                // Helper function to find the closest x position for a value
                const getXPositionForValue = (targetValue) => {
                    const labels = chart.data.labels;
                    const numericLabels = labels.map(l => parseFloat(l));
                    
                    // Find exact match first
                    const exactIndex = labels.indexOf(targetValue.toString());
                    if (exactIndex !== -1) {
                        return xScale.getPixelForValue(exactIndex);
                    }
                    
                    // If no exact match, interpolate between closest values
                    let leftIndex = -1, rightIndex = -1;
                    
                    for (let i = 0; i < numericLabels.length; i++) {
                        if (numericLabels[i] <= targetValue) {
                            leftIndex = i;
                        }
                        if (numericLabels[i] >= targetValue && rightIndex === -1) {
                            rightIndex = i;
                            break;
                        }
                    }
                    
                    if (leftIndex === -1 && rightIndex !== -1) {
                        // Target is before all values
                        return xScale.getPixelForValue(rightIndex) - (xScale.width / labels.length) * 0.5;
                    } else if (rightIndex === -1 && leftIndex !== -1) {
                        // Target is after all values
                        return xScale.getPixelForValue(leftIndex) + (xScale.width / labels.length) * 0.5;
                    } else if (leftIndex !== -1 && rightIndex !== -1) {
                        // Interpolate between left and right
                        const leftX = xScale.getPixelForValue(leftIndex);
                        const rightX = xScale.getPixelForValue(rightIndex);
                        const leftVal = numericLabels[leftIndex];
                        const rightVal = numericLabels[rightIndex];
                        
                        if (leftVal === rightVal) return leftX;
                        
                        const ratio = (targetValue - leftVal) / (rightVal - leftVal);
                        return leftX + (rightX - leftX) * ratio;
                    }
                    
                    return null;
                };

                // Draw median line
                const medianX = getXPositionForValue(stats.median);
                if (medianX !== null && medianX >= xScale.left && medianX <= xScale.right) {
                    ctx.save();
                    ctx.strokeStyle = '#64d2b4'; // mint
                    ctx.lineWidth = 4;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(medianX, yScale.top);
                    ctx.lineTo(medianX, yScale.bottom);
                    ctx.stroke();
                    ctx.restore();

                    // Add label
                    ctx.save();
                    ctx.fillStyle = '#64d2b4'; // mint
                    ctx.font = 'bold 16px Rubik';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Median: ${stats.median.toFixed(2)}`, medianX, yScale.top - 10);
                    ctx.restore();
                }

                // Draw average line
                const avgX = getXPositionForValue(stats.average);
                if (avgX !== null && avgX >= xScale.left && avgX <= xScale.right) {
                    ctx.save();
                    ctx.strokeStyle = '#064075'; // blue
                    ctx.lineWidth = 4;
                    ctx.setLineDash([10, 5]);
                    ctx.beginPath();
                    ctx.moveTo(avgX, yScale.top);
                    ctx.lineTo(avgX, yScale.bottom);
                    ctx.stroke();
                    ctx.restore();

                    // Add label
                    ctx.save();
                    ctx.fillStyle = '#064075'; // blue
                    ctx.font = 'bold 16px Rubik';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Average: ${stats.average.toFixed(2)}`, avgX, yScale.top - 30);
                    ctx.restore();
                }
            }
        };

        const config = {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 16/9,
                layout: {
                    padding: {
                        top: 80
                    }
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency',
                            font: {
                                family: 'Rubik',
                                size: 16,
                                weight: '500'
                            },
                            color: '#064075' // blue
                        },
                        ticks: {
                            stepSize: 1,
                            font: {
                                family: 'Rubik',
                                size: 14
                            },
                            color: '#064075', // blue
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Value',
                            font: {
                                family: 'Rubik',
                                size: 16,
                                weight: '500'
                            },
                            color: '#064075' // blue
                        },
                        ticks: {
                            font: {
                                family: 'Rubik',
                                size: 14
                            },
                            color: '#064075' // blue
                        }
                    }
                }
            },
            plugins: [verticalLinesPlugin]
        };

        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('distributionChart').getContext('2d');
        this.chart = new Chart(ctx, config);

        this.showChart();
    }

    showChart() {
        document.getElementById('chartSection').style.display = 'block';
    }

    hideChart() {
        document.getElementById('chartSection').style.display = 'none';
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new CSVStatsVisualizer();
});
