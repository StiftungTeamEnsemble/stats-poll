class CSVStatsVisualizer {
  constructor() {
    this.csvData = null;
    this.chart = null;
    this.dateColumn = null;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const columnSelect = document.getElementById("columnSelect");
    const downloadButton = document.getElementById("downloadButton");
    const dateFromInput = document.getElementById("dateFrom");
    const dateToInput = document.getElementById("dateTo");
    const minLabelInput = document.getElementById("minLabel");
    const maxLabelInput = document.getElementById("maxLabel");

    // Drop zone events
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", this.handleDragOver.bind(this));
    dropZone.addEventListener("drop", this.handleDrop.bind(this));

    // File input change
    fileInput.addEventListener("change", (e) =>
      this.handleFileSelect(e.target.files[0]),
    );

    // Column selection change
    columnSelect.addEventListener("change", this.handleColumnChange.bind(this));

    // Date filter changes
    dateFromInput.addEventListener(
      "change",
      this.handleDateFilterChange.bind(this),
    );
    dateToInput.addEventListener(
      "change",
      this.handleDateFilterChange.bind(this),
    );

    // Scale label changes
    minLabelInput.addEventListener("input", this.handleLabelChange.bind(this));
    maxLabelInput.addEventListener("input", this.handleLabelChange.bind(this));

    // Download button click
    downloadButton.addEventListener("click", this.downloadChart.bind(this));
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
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
    const lines = csvText.trim().split("\n");
    const headers = this.parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }

    this.csvData = { headers, data };
    this.detectDateColumn();
    this.populateColumnSelect();
    this.showControls();
    this.setupDateFilter();
  }

  detectDateColumn() {
    // Look for common date column names
    const dateColumnNames = [
      "date",
      "Date",
      "Datum",
      "datum",
      "Datum & Zeit",
      "datum & zeit",
    ];

    for (const columnName of dateColumnNames) {
      if (this.csvData.headers.includes(columnName)) {
        this.dateColumn = columnName;
        break;
      }
    }
  }

  setupDateFilter() {
    if (!this.dateColumn) return;

    // Show date filter section
    document.getElementById("dateFilterSection").style.display = "block";

    // Find the date range in the data
    const dates = this.csvData.data
      .map((row) => this.parseDate(row[this.dateColumn]))
      .filter((date) => date !== null)
      .sort((a, b) => a - b);

    if (dates.length > 0) {
      // Use the actual data range
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      // Format dates without timezone issues
      const minDateString = this.formatDateForInput(minDate);
      const maxDateString = this.formatDateForInput(maxDate);

      document.getElementById("dateFrom").value = minDateString;
      document.getElementById("dateTo").value = maxDateString;
    } else {
      // Fallback to current day if no valid dates found
      const today = new Date();
      const todayString = this.formatDateForInput(today);

      document.getElementById("dateFrom").value = todayString;
      document.getElementById("dateTo").value = todayString;
    }
  }

  formatDateForInput(date) {
    // Format date as YYYY-MM-DD without timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  parseDate(dateString) {
    // Parse dates in format "DD.MM.YYYY, HH:MM" or similar
    if (!dateString || typeof dateString !== "string") {
      return null;
    }

    // Remove quotes if present
    const cleanDateString = dateString.replace(/['"]/g, "");

    const match = cleanDateString.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      const parsedDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
      return parsedDate;
    }
    return null;
  }

  handleDateFilterChange() {
    const columnName = document.getElementById("columnSelect").value;
    if (columnName) {
      this.renderChart(columnName);
    }
  }

  handleLabelChange() {
    const columnName = document.getElementById("columnSelect").value;
    if (columnName) {
      this.renderChart(columnName);
    }
  }

  getFilteredData() {
    if (!this.dateColumn) {
      return this.csvData.data;
    }

    const dateFromInput = document.getElementById("dateFrom");
    const dateToInput = document.getElementById("dateTo");

    if (!dateFromInput.value || !dateToInput.value) {
      this.updateFilterResult(
        this.csvData.data.length,
        this.csvData.data.length,
      );
      return this.csvData.data;
    }

    // Parse input dates correctly - split the YYYY-MM-DD format and create dates with local timezone
    const fromDateParts = dateFromInput.value.split("-");
    const toDateParts = dateToInput.value.split("-");

    const fromDate = new Date(
      parseInt(fromDateParts[0]),
      parseInt(fromDateParts[1]) - 1,
      parseInt(fromDateParts[2]),
    );
    const toDate = new Date(
      parseInt(toDateParts[0]),
      parseInt(toDateParts[1]) - 1,
      parseInt(toDateParts[2]),
    );

    // Set time to end of day for 'to' date to include the full day
    toDate.setHours(23, 59, 59, 999);

    const filteredData = this.csvData.data.filter((row) => {
      const dateValue = row[this.dateColumn];
      const rowDate = this.parseDate(dateValue);

      if (!rowDate) {
        return false; // Exclude rows with invalid dates
      }

      return rowDate >= fromDate && rowDate <= toDate;
    });

    this.updateFilterResult(filteredData.length, this.csvData.data.length);
    return filteredData;
  }

  updateFilterResult(filteredCount, totalCount) {
    const filterResultElement = document.getElementById("filterResult");
    const filterResultText = document.getElementById("filterResultText");

    if (this.dateColumn && filteredCount !== totalCount) {
      filterResultText.textContent = `Gefiltert: ${filteredCount} von ${totalCount} Einträgen`;
      filterResultElement.style.display = "block";
    } else if (this.dateColumn) {
      filterResultText.textContent = `Alle ${totalCount} Einträge angezeigt`;
      filterResultElement.style.display = "block";
    } else {
      filterResultElement.style.display = "none";
    }
  }

  parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  isNumericColumn(columnName) {
    if (!this.csvData) return false;

    const filteredData = this.getFilteredData();
    const values = filteredData
      .map((row) => row[columnName])
      .filter(
        (val) => val !== "" && val !== "-" && val !== null && val !== undefined,
      );

    if (values.length === 0) return false;

    // Check if at least 80% of non-empty values are numeric
    const numericCount = values.filter(
      (val) => !isNaN(parseFloat(val)) && isFinite(val),
    ).length;
    return numericCount / values.length >= 0.8;
  }

  populateColumnSelect() {
    const select = document.getElementById("columnSelect");
    select.innerHTML =
      '<option value="">Wählen Sie eine numerische Spalte...</option>';

    this.csvData.headers.forEach((header) => {
      if (this.isNumericColumn(header)) {
        const option = document.createElement("option");
        option.value = header;
        option.textContent = header;
        select.appendChild(option);
      }
    });
  }

  showControls() {
    document.getElementById("controlsSection").style.display = "block";
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
    const filteredData = this.getFilteredData();
    return filteredData
      .map((row) => parseFloat(row[columnName]))
      .filter((val) => !isNaN(val) && isFinite(val));
  }

  calculateStats(values) {
    if (values.length === 0) return { average: 0, median: 0 };

    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;

    const sorted = [...values].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    return { average, median };
  }

  getDistribution(values) {
    const distribution = {};
    values.forEach((val) => {
      distribution[val] = (distribution[val] || 0) + 1;
    });
    return distribution;
  }

  renderChart(columnName) {
    const values = this.getNumericValues(columnName);
    const stats = this.calculateStats(values);
    const distribution = this.getDistribution(values);

    // Update title and stats
    document.getElementById("chartTitle").textContent = columnName;
    document.getElementById("averageValue").textContent =
      stats.average.toFixed(2);
    document.getElementById("medianValue").textContent =
      stats.median.toFixed(2);

    // Generate dynamic range based on data min/max with constraints
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const rangeMin = Math.min(dataMin, 1); // min should not be bigger than 1
    const rangeMax = Math.max(dataMax, 10); // max should not be smaller than 10

    const fixedLabels = [];
    for (let i = rangeMin; i <= rangeMax; i++) {
      fixedLabels.push(i.toString());
    }
    const chartData = {
      labels: fixedLabels,
      datasets: [
        {
          label: "Anzahl",
          data: fixedLabels.map((label) => distribution[label] || 0),
          backgroundColor: "rgba(0, 140, 230, 0.6)", // cyan with opacity
          borderColor: "#008ce6", // cyan
          borderWidth: 2,
        },
      ],
    };

    // Custom plugin for vertical lines
    const verticalLinesPlugin = {
      id: "verticalLines",
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        // Helper function to find the closest x position for a value
        const getXPositionForValue = (targetValue) => {
          const labels = chart.data.labels;
          const numericLabels = labels.map((l) => parseFloat(l));

          // Find exact match first
          const exactIndex = labels.indexOf(targetValue.toString());
          if (exactIndex !== -1) {
            return xScale.getPixelForValue(exactIndex);
          }

          // If no exact match, interpolate between closest values
          let leftIndex = -1,
            rightIndex = -1;

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
            return (
              xScale.getPixelForValue(rightIndex) -
              (xScale.width / labels.length) * 0.5
            );
          } else if (rightIndex === -1 && leftIndex !== -1) {
            // Target is after all values
            return (
              xScale.getPixelForValue(leftIndex) +
              (xScale.width / labels.length) * 0.5
            );
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
        if (
          medianX !== null &&
          medianX >= xScale.left &&
          medianX <= xScale.right
        ) {
          ctx.save();
          ctx.strokeStyle = "#064075"; // mint
          ctx.lineWidth = 4;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(medianX, yScale.top);
          ctx.lineTo(medianX, yScale.bottom);
          ctx.stroke();
          ctx.restore();

          // Add label
          ctx.save();
          ctx.fillStyle = "#064075"; // mint
          ctx.font = "bold 20px Rubik";
          ctx.textAlign = "center";
          ctx.fillText(
            `Median: ${stats.median.toFixed(2)}`,
            medianX,
            yScale.top - 20,
          );
          ctx.restore();
        }

        // Draw average line
        const avgX = getXPositionForValue(stats.average);
        if (avgX !== null && avgX >= xScale.left && avgX <= xScale.right) {
          ctx.save();
          ctx.strokeStyle = "#064075"; // blue
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(avgX, yScale.top);
          ctx.lineTo(avgX, yScale.bottom);
          ctx.stroke();
          ctx.restore();

          // Add label
          ctx.save();
          ctx.fillStyle = "#064075"; // blue
          ctx.font = "bold 20px Rubik";
          ctx.textAlign = "center";
          ctx.fillText(
            `Durchschnitt: ${stats.average.toFixed(2)}`,
            avgX,
            yScale.top - 50,
          );
          ctx.restore();
        }
      },
    };

    // Custom plugin for scale labels
    const scaleLabelsPlugin = {
      id: "scaleLabels",
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        const minLabel = document.getElementById("minLabel").value;
        const maxLabel = document.getElementById("maxLabel").value;

        if (minLabel || maxLabel) {
          ctx.save();
          ctx.fillStyle = "#064075";
          ctx.font = "500 20px Rubik";

          const labels = chart.data.labels;
          const numericLabels = labels.map((l) => parseFloat(l));
          const minValue = Math.min(...numericLabels);
          const maxValue = Math.max(...numericLabels);

          // Find the x positions for min and max values
          const minIndex = labels.indexOf(minValue.toString());
          const maxIndex = labels.indexOf(maxValue.toString());

          if (minIndex !== -1 && minLabel) {
            const minX = xScale.getPixelForValue(minIndex);
            ctx.textAlign = "center";
            ctx.fillText(minLabel, minX, yScale.bottom + 70);
          }

          if (maxIndex !== -1 && maxLabel) {
            const maxX = xScale.getPixelForValue(maxIndex);
            ctx.textAlign = "center";
            ctx.fillText(maxLabel, maxX, yScale.bottom + 70);
          }

          ctx.restore();
        }
      },
    };

    const config = {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 16 / 9,
        layout: {
          padding: {
            top: 80,
            bottom: 40,
          },
        },
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Häufigkeit",
              font: {
                family: "Rubik",
                size: 24,
                weight: "500",
              },
              color: "#064075", // blue
            },
            ticks: {
              stepSize: 1,
              font: {
                family: "Rubik",
                size: 24,
              },
              color: "#064075", // blue
              callback: function (value) {
                return Number.isInteger(value) ? value : "";
              },
            },
          },
          x: {
            title: {
              display: true,
              text: "Wert",
              font: {
                family: "Rubik",
                size: 24,
                weight: "500",
              },
              color: "#064075", // blue
            },
            ticks: {
              font: {
                family: "Rubik",
                size: 24,
              },
              color: "#064075", // blue
            },
          },
        },
      },
      plugins: [verticalLinesPlugin, scaleLabelsPlugin],
    };

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new chart
    const ctx = document.getElementById("distributionChart").getContext("2d");
    this.chart = new Chart(ctx, config);

    this.showChart();
  }

  showChart() {
    document.getElementById("chartSection").style.display = "block";
  }

  downloadChart() {
    if (!this.chart) return;

    // Get the column name for the filename
    const columnName = document.getElementById("chartTitle").textContent;
    const sanitizedColumnName = columnName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${sanitizedColumnName}.png`;

    // Create a link element and trigger download
    const link = document.createElement("a");
    link.download = filename;
    link.href = this.chart.toBase64Image("image/png", 1);
    link.click();
  }

  hideChart() {
    document.getElementById("chartSection").style.display = "none";
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new CSVStatsVisualizer();
});
