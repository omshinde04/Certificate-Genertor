document.addEventListener("DOMContentLoaded", () => {
  const templateUpload = document.getElementById("template-upload");
  const excelUpload = document.getElementById("excel-upload");
  const certificateContainer = document.getElementById("certificate-container");
  const fieldsContainer = document.getElementById("fields-container");
  const downloadLink = document.getElementById("download-link");

  const fontSizeInput = document.getElementById("font-size");
  const boldToggle = document.getElementById("bold-toggle");
  const colorPicker = document.getElementById("color-picker");
  const fontSelector = document.getElementById("font-selector");

  let fieldPositions = [];
  let excelData = [];
  let excelHeaders = [];
  let currentField = null;
  let isDragging = false;
  let offsetX, offsetY;
  let signatures = {}; // To store signature images

  // Upload certificate template
  templateUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.getElementById("template-img");
        img.src = event.target.result;

        // Reset positioning when new template is uploaded
        fieldsContainer.innerHTML = "";
        fieldPositions = [];
      };
      reader.readAsDataURL(file);
    }
  });

  // Upload and parse Excel data
  excelUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        excelData = XLSX.utils.sheet_to_json(sheet);

        // Extract headers from Excel
        excelHeaders = Object.keys(excelData[0] || {});

        // Update the header selection dropdown
        updateHeadersDropdown();

        console.log("Excel Data:", excelData);
        console.log("Excel Headers:", excelHeaders);

        // Show success notification
        showNotification("Excel file loaded successfully!", "success");
      };
      reader.readAsArrayBuffer(file);
    }
  });

  // Update header dropdown based on Excel file
  const updateHeadersDropdown = () => {
    const headerDropdown = document.getElementById("excel-headers");
    headerDropdown.innerHTML = '<option value="">-- Select Header --</option>';

    excelHeaders.forEach((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      headerDropdown.appendChild(option);
    });

    // Enable the add field button if headers exist
    const addFieldBtn = document.getElementById("add-field-btn");
    if (addFieldBtn) {
      addFieldBtn.disabled = excelHeaders.length === 0;
    }

    // Show the header selection container
    const headerContainer = document.getElementById("header-selection");
    if (headerContainer) {
      headerContainer.classList.toggle("hidden", excelHeaders.length === 0);
    }
  };

  // Add field from Excel headers
  window.addFieldFromHeader = () => {
    const headerDropdown = document.getElementById("excel-headers");
    if (headerDropdown && headerDropdown.value) {
      addField(headerDropdown.value);
    } else {
      showNotification("Please select a header first", "error");
    }
  };

  // Add custom field
  window.addCustomField = () => {
    const customFieldInput = document.getElementById("custom-field-input");
    if (customFieldInput && customFieldInput.value.trim()) {
      addField(customFieldInput.value.trim());
      customFieldInput.value = "";
    } else {
      showNotification("Please enter a field name", "error");
    }
  };

  // Add draggable field
  window.addField = (label) => {
    const field = document.createElement("div");
    field.classList.add("field");
    field.dataset.label = label;
    field.dataset.type = label === "Signature" ? "signature" : "text";

    // Field content container
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("field-content");

    if (label === "Signature") {
      // For signature fields, add upload option and preview
      contentDiv.innerHTML = `
                <div class="signature-placeholder">
                    <i class="fas fa-signature"></i>
                    <span>Signature</span>
                </div>
                <input type="file" class="signature-upload hidden" accept="image/*">
            `;
      // Add click event to trigger file upload
      contentDiv
        .querySelector(".signature-placeholder")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          if (!isDragging) {
            contentDiv.querySelector(".signature-upload").click();
          }
        });

      // Handle signature upload
      contentDiv
        .querySelector(".signature-upload")
        .addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              // Create signature ID
              const signatureId = "sig_" + Date.now();
              field.dataset.signatureId = signatureId;

              // Store signature
              signatures[signatureId] = event.target.result;

              // Update preview
              const placeholder = contentDiv.querySelector(
                ".signature-placeholder"
              );
              placeholder.innerHTML = "";

              // Create an image element for better control
              const img = document.createElement("img");
              img.src = event.target.result;
              img.style.maxWidth = "100%";
              img.style.maxHeight = "60px";
              img.style.objectFit = "contain";
              placeholder.appendChild(img);

              saveFieldPositions();
            };
            reader.readAsDataURL(file);
          }
        });
    } else {
      contentDiv.textContent = label;
    }

    field.appendChild(contentDiv);

    // Apply current styling options
    field.style.fontFamily = fontSelector.value;
    field.style.color = colorPicker.value;
    field.style.fontSize = `${fontSizeInput.value}px`;
    field.style.fontWeight = boldToggle.checked ? "bold" : "normal";

    // Store styling with the field
    field.dataset.style = JSON.stringify({
      fontFamily: fontSelector.value,
      color: colorPicker.value,
      fontSize: fontSizeInput.value,
      fontWeight: boldToggle.checked ? "bold" : "normal",
    });

    // Control buttons container
    const controlsDiv = document.createElement("div");
    controlsDiv.classList.add(
      "field-controls",
      "absolute",
      "top-0",
      "right-0",
      "bg-white",
      "bg-opacity-80",
      "rounded",
      "p-1"
    );
    controlsDiv.style.display = "none"; // Hide controls by default

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.innerHTML = '<i class="fa fa-edit"></i>';
    editBtn.classList.add("edit-btn", "text-blue-600", "mx-1");
    editBtn.title = "Edit Styling";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      editFieldStyle(field);
    };

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = '<i class="fa fa-times"></i>';
    removeBtn.classList.add("remove-btn", "text-red-600", "mx-1");
    removeBtn.title = "Remove Field";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      field.remove();
      saveFieldPositions();
    };

    controlsDiv.appendChild(editBtn);
    controlsDiv.appendChild(removeBtn);
    field.appendChild(controlsDiv);

    // Set initial position
    const containerRect = certificateContainer.getBoundingClientRect();
    field.style.left = `${containerRect.width / 2 - 60}px`;
    field.style.top = `${containerRect.height / 2 - 20}px`;

    fieldsContainer.appendChild(field);
    makeDraggable(field);

    // Select the newly added field
    selectField(field);

    saveFieldPositions();

    showNotification(`Field "${label}" added`, "success");
  };

  // Edit field styling
  const editFieldStyle = (field) => {
    // Select the field first
    selectField(field);

    // Get current field styling
    const fieldStyle = JSON.parse(field.dataset.style || "{}");

    // Update styling controls to match field
    fontSelector.value = fieldStyle.fontFamily || "Arial";
    colorPicker.value = fieldStyle.color || "#000000";
    fontSizeInput.value = fieldStyle.fontSize || 20;
    boldToggle.checked = fieldStyle.fontWeight === "bold";

    // Highlight styling panel
    document.getElementById("styling-panel").classList.add("highlight");
    setTimeout(() => {
      document.getElementById("styling-panel").classList.remove("highlight");
    }, 1000);
  };

  // Select a field for editing
  const selectField = (field) => {
    // Deselect any currently selected field
    document.querySelectorAll(".field.selected").forEach((f) => {
      f.classList.remove("selected");
      f.querySelector(".field-controls").style.display = "none";
    });

    // Select the clicked field
    field.classList.add("selected");
    field.querySelector(".field-controls").style.display = "block";
    currentField = field;
  };

  // Apply styling to selected field
  const applyStyleToSelected = () => {
    if (!currentField) return;

    currentField.style.fontFamily = fontSelector.value;
    currentField.style.color = colorPicker.value;
    currentField.style.fontSize = `${fontSizeInput.value}px`;
    currentField.style.fontWeight = boldToggle.checked ? "bold" : "normal";

    // Update stored styling
    currentField.dataset.style = JSON.stringify({
      fontFamily: fontSelector.value,
      color: colorPicker.value,
      fontSize: fontSizeInput.value,
      fontWeight: boldToggle.checked ? "bold" : "normal",
    });

    saveFieldPositions();
  };

  // Styling options event listeners
  fontSelector.addEventListener("change", applyStyleToSelected);
  fontSizeInput.addEventListener("change", applyStyleToSelected);
  boldToggle.addEventListener("change", applyStyleToSelected);
  colorPicker.addEventListener("change", applyStyleToSelected);

  // Improved draggable functionality
  const makeDraggable = (field) => {
    // Mouse down event handler
    field.addEventListener("mousedown", (e) => {
      // Don't initiate drag if clicking on buttons or signature upload
      if (
        e.target.closest(".field-controls") ||
        e.target.closest(".signature-upload")
      )
        return;

      e.preventDefault();

      // Select the field
      selectField(field);

      // Calculate offset based on click position relative to field
      const fieldRect = field.getBoundingClientRect();
      offsetX = e.clientX - fieldRect.left;
      offsetY = e.clientY - fieldRect.top;

      // Mark as dragging
      isDragging = true;
      field.classList.add("dragging");

      // Prevent content from being dragged
      document.body.style.userSelect = "none";
    });
  };

  // Global mouse move handler (for smoother dragging)
  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !currentField) return;

    // Get container bounds
    const containerRect = certificateContainer.getBoundingClientRect();

    // Calculate new position relative to container
    let x = e.clientX - containerRect.left - offsetX;
    let y = e.clientY - containerRect.top - offsetY;

    // Constrain to container boundaries
    const maxX = containerRect.width - currentField.offsetWidth;
    const maxY = containerRect.height - currentField.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    currentField.style.left = `${x}px`;
    currentField.style.top = `${y}px`;
  });

  // Global mouse up handler
  document.addEventListener("mouseup", () => {
    if (!isDragging) return;

    // Reset dragging state
    isDragging = false;

    document.querySelectorAll(".field.dragging").forEach((f) => {
      f.classList.remove("dragging");
    });

    // Re-enable text selection
    document.body.style.userSelect = "";

    // Save the new positions
    saveFieldPositions();
  });

  // Save field positions and styling
  const saveFieldPositions = () => {
    fieldPositions = [];
    document.querySelectorAll(".field").forEach((field) => {
      const { left, top } = field.style;
      const style = JSON.parse(field.dataset.style || "{}");

      const fieldData = {
        label: field.dataset.label,
        x: parseInt(left),
        y: parseInt(top),
        style: style,
        type: field.dataset.type || "text",
      };

      // Add signature data if applicable
      if (field.dataset.type === "signature" && field.dataset.signatureId) {
        fieldData.signatureId = field.dataset.signatureId;
      }

      fieldPositions.push(fieldData);
    });

    // Save to localStorage for persistence
    localStorage.setItem("certificateFields", JSON.stringify(fieldPositions));
    localStorage.setItem("certificateSignatures", JSON.stringify(signatures));

    console.log("Field Positions:", fieldPositions);
  };

  // Restore fields from saved positions
  const restoreFields = () => {
    try {
      const savedFields = localStorage.getItem("certificateFields");
      const savedSignatures = localStorage.getItem("certificateSignatures");

      if (savedFields) {
        const fields = JSON.parse(savedFields);
        if (savedSignatures) {
          signatures = JSON.parse(savedSignatures);
        }

        fields.forEach((field) => {
          // Create field
          const fieldElement = document.createElement("div");
          fieldElement.classList.add("field");
          fieldElement.dataset.label = field.label;
          fieldElement.dataset.type = field.type || "text";

          // Create content
          const contentDiv = document.createElement("div");
          contentDiv.classList.add("field-content");

          if (field.type === "signature" && field.signatureId) {
            fieldElement.dataset.signatureId = field.signatureId;

            // Add signature placeholder
            contentDiv.innerHTML = `
                            <div class="signature-placeholder">
                                <i class="fas fa-signature"></i>
                                <span>Signature</span>
                            </div>
                            <input type="file" class="signature-upload hidden" accept="image/*">
                        `;

            // Restore signature if available
            if (signatures[field.signatureId]) {
              const placeholder = contentDiv.querySelector(
                ".signature-placeholder"
              );
              placeholder.innerHTML = "";

              // Create image element for signature
              const img = document.createElement("img");
              img.src = signatures[field.signatureId];
              img.style.maxWidth = "100%";
              img.style.maxHeight = "60px";
              img.style.objectFit = "contain";
              placeholder.appendChild(img);
            }

            // Add click event to trigger file upload
            contentDiv
              .querySelector(".signature-placeholder")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                if (!isDragging) {
                  contentDiv.querySelector(".signature-upload").click();
                }
              });

            // Handle signature upload
            contentDiv
              .querySelector(".signature-upload")
              .addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    // Update signature
                    signatures[field.signatureId] = event.target.result;

                    // Update preview
                    const placeholder = contentDiv.querySelector(
                      ".signature-placeholder"
                    );
                    placeholder.innerHTML = "";

                    // Create an image element
                    const img = document.createElement("img");
                    img.src = event.target.result;
                    img.style.maxWidth = "100%";
                    img.style.maxHeight = "60px";
                    img.style.objectFit = "contain";
                    placeholder.appendChild(img);

                    saveFieldPositions();
                  };
                  reader.readAsDataURL(file);
                }
              });
          } else {
            contentDiv.textContent = field.label;
          }

          fieldElement.appendChild(contentDiv);

          // Apply styling
          fieldElement.style.fontFamily = field.style.fontFamily;
          fieldElement.style.color = field.style.color;
          fieldElement.style.fontSize = `${field.style.fontSize}px`;
          fieldElement.style.fontWeight = field.style.fontWeight;
          fieldElement.dataset.style = JSON.stringify(field.style);

          // Set position
          fieldElement.style.left = `${field.x}px`;
          fieldElement.style.top = `${field.y}px`;

          // Add control buttons
          const controlsDiv = document.createElement("div");
          controlsDiv.classList.add(
            "field-controls",
            "absolute",
            "top-0",
            "right-0",
            "bg-white",
            "bg-opacity-80",
            "rounded",
            "p-1"
          );
          controlsDiv.style.display = "none";

          // Edit button
          const editBtn = document.createElement("button");
          editBtn.innerHTML = '<i class="fa fa-edit"></i>';
          editBtn.classList.add("edit-btn", "text-blue-600", "mx-1");
          editBtn.title = "Edit Styling";
          editBtn.onclick = (e) => {
            e.stopPropagation();
            editFieldStyle(fieldElement);
          };

          // Remove button
          const removeBtn = document.createElement("button");
          removeBtn.innerHTML = '<i class="fa fa-times"></i>';
          removeBtn.classList.add("remove-btn", "text-red-600", "mx-1");
          removeBtn.title = "Remove Field";
          removeBtn.onclick = (e) => {
            e.stopPropagation();
            fieldElement.remove();
            saveFieldPositions();
          };

          controlsDiv.appendChild(editBtn);
          controlsDiv.appendChild(removeBtn);
          fieldElement.appendChild(controlsDiv);

          // Add to container
          fieldsContainer.appendChild(fieldElement);
          makeDraggable(fieldElement);
        });
      }
    } catch (e) {
      console.error("Error restoring fields:", e);
    }
  };

  // Generate PDF certificates with improved styling
  window.generateCertificates = async () => {
    if (!excelData.length) {
      showNotification("Please upload Excel data first!", "error");
      return;
    }

    if (!fieldPositions.length) {
      showNotification("Please add and position fields first!", "error");
      return;
    }

    // Show loading indicator
    const loadingIndicator = document.createElement("div");
    loadingIndicator.classList.add("loading-overlay");
    loadingIndicator.innerHTML =
      '<div class="spinner"></div><p>Generating certificates...</p>';
    document.body.appendChild(loadingIndicator);

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [842, 595],
      });

      // Get template dimensions
      const templateImg = document.getElementById("template-img");
      const containerWidth = certificateContainer.offsetWidth;
      const containerHeight = certificateContainer.offsetHeight;

      // Scale factor for positioning
      const scaleX = 842 / containerWidth;
      const scaleY = 595 / containerHeight;

      // Hide field controls for clean capture
      document.querySelectorAll(".field-controls").forEach((control) => {
        control.style.display = "none";
      });

      for (let i = 0; i < excelData.length; i++) {
        const data = excelData[i];

        // Create a temporary container for this certificate
        const tempContainer = certificateContainer.cloneNode(true);
        tempContainer.style.position = "absolute";
        tempContainer.style.left = "-9999px";
        document.body.appendChild(tempContainer);

        // Get fields container in cloned element
        const tempFieldsContainer =
          tempContainer.querySelector("#fields-container");

        // Clear fields and add dynamic content for this record
        tempFieldsContainer.innerHTML = "";

        // Add fields with data from Excel
        fieldPositions.forEach((pos) => {
          const fieldElement = document.createElement("div");
          fieldElement.classList.add("field");
          fieldElement.style.position = "absolute";
          fieldElement.style.left = `${pos.x}px`;
          fieldElement.style.top = `${pos.y}px`;

          // Apply styling
          fieldElement.style.fontFamily = pos.style.fontFamily;
          fieldElement.style.color = pos.style.color;
          fieldElement.style.fontSize = `${pos.style.fontSize}px`;
          fieldElement.style.fontWeight = pos.style.fontWeight;

          const contentDiv = document.createElement("div");
          contentDiv.classList.add("field-content");

          // Handle different field types
          if (
            pos.type === "signature" &&
            pos.signatureId &&
            signatures[pos.signatureId]
          ) {
            // Create image for signature
            const signatureImg = document.createElement("img");
            signatureImg.src = signatures[pos.signatureId];
            signatureImg.style.maxHeight = "60px";
            signatureImg.style.maxWidth = "100%";
            signatureImg.style.objectFit = "contain";
            contentDiv.appendChild(signatureImg);
          } else {
            // Get value from Excel data or use placeholder
            const value = data[pos.label] || pos.label;
            contentDiv.textContent = value;
          }

          fieldElement.appendChild(contentDiv);
          tempFieldsContainer.appendChild(fieldElement);
        });

        // Capture the certificate with data
        const canvas = await html2canvas(tempContainer, {
          useCORS: true,
          allowTaint: true,
          scale: 2, // Higher quality rendering
        });

        // Add to PDF
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, 842, 595);

        // Remove temp container
        document.body.removeChild(tempContainer);

        // Update progress
        loadingIndicator.innerHTML = `<div class="spinner"></div><p>Generating certificate ${
          i + 1
        } of ${excelData.length}...</p>`;
      }

      // Show controls again
      document.querySelectorAll(".field.selected").forEach((field) => {
        field.querySelector(".field-controls").style.display = "block";
      });

      // Generate PDF and download
      const pdfBlob = pdf.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      downloadLink.href = url;
      downloadLink.download = "Certificates.pdf";
      downloadLink.classList.remove("hidden");
      downloadLink.textContent = "Download Certificates";

      showNotification(
        `${excelData.length} certificates generated successfully!`,
        "success"
      );
    } catch (error) {
      console.error("Error generating certificates:", error);
      showNotification(
        "Error generating certificates: " + error.message,
        "error"
      );
    } finally {
      // Remove loading indicator
      document.body.removeChild(loadingIndicator);
    }
  };

  // Reset all fields
  window.resetFields = () => {
    fieldsContainer.innerHTML = "";
    fieldPositions = [];
    signatures = {};
    localStorage.removeItem("certificateFields");
    localStorage.removeItem("certificateSignatures");
    showNotification("All fields have been reset", "info");
  };

  // Add reset button to UI
  const resetButton = document.createElement("button");
  resetButton.innerText = "Reset All Fields";
  resetButton.classList.add(
    "mt-4",
    "px-3",
    "py-2",
    "bg-red-600",
    "text-white",
    "rounded-md",
    "hover:bg-red-700",
    "transition-colors"
  );
  resetButton.onclick = window.resetFields;
  document.getElementById("fields-panel").appendChild(resetButton);

  // Show notification
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.classList.add("notification", type);
    notification.textContent = message;

    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.classList.add("show");
    }, 10);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // Initialize field selection on click within certificate
  certificateContainer.addEventListener("click", (e) => {
    // Deselect if clicking on the container but not on a field
    if (
      e.target === certificateContainer ||
      e.target === document.getElementById("template-img")
    ) {
      document.querySelectorAll(".field.selected").forEach((f) => {
        f.classList.remove("selected");
        f.querySelector(".field-controls").style.display = "none";
      });
      currentField = null;
    }
  });

  // Add a button to download link container for re-generating
  const regenerateButton = document.createElement("button");
  regenerateButton.innerText = "Re-Generate Certificates";
  regenerateButton.classList.add(
    "w-full",
    "mt-2",
    "py-3",
    "px-4",
    "bg-green-600",
    "hover:bg-green-700",
    "text-white",
    "font-bold",
    "rounded-md",
    "transition-colors",
    "shadow-md",
    "hidden"
  );
  regenerateButton.onclick = window.generateCertificates;

  // Insert before download link
  downloadLink.parentNode.insertBefore(regenerateButton, downloadLink);

  // Show regenerate button when download is available
  const originalGenerateCertificates = window.generateCertificates;
  window.generateCertificates = async function () {
    await originalGenerateCertificates();
    regenerateButton.classList.remove("hidden");
  };

  // Try to restore saved fields on load
  restoreFields();
});

// Add these CSS styles to the head
document.addEventListener("DOMContentLoaded", () => {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .field {
        position: absolute;
        min-width: 120px;
        min-height: 30px;
        cursor: move;
        z-index: 10;
        border: 1px solid transparent;
        padding: 4px 8px;
        border-radius: 4px;
        
        box-sizing: border-box;
        touch-action: none;
    }
    .field:hover {
        border-color: #ddd;
        background-color: rgba(255, 255, 255, 0.7);
    }
    .field.selected {
        border: 2px solid #10b981;
        z-index: 20;
    }
    .field.dragging {
        opacity: 0.8;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    .field-content {
        pointer-events: none;
        user-select: none;
    }
    .signature-placeholder {
        min-width: 120px;
        min-height: 40px;
        border: 1px dashed #999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }
    .signature-placeholder i {
        font-size: 20px;
        margin-bottom: 4px;
    }
    .signature-placeholder img {
        pointer-events: none;
    }
    `;
  document.head.appendChild(styleElement);
});

// This function handles the generation of certificates, with updated signature handling
window.generateCertificates = async () => {
  if (!excelData.length) {
    showNotification("Please upload Excel data first!", "error");
    return;
  }

  if (!fieldPositions.length) {
    showNotification("Please add and position fields first!", "error");
    return;
  }

  // Show loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.classList.add("loading-overlay");
  loadingIndicator.innerHTML =
    '<div class="spinner"></div><p>Generating certificates...</p>';
  document.body.appendChild(loadingIndicator);

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [842, 595],
    });

    // Get template dimensions
    const templateImg = document.getElementById("template-img");
    const containerWidth = certificateContainer.offsetWidth;
    const containerHeight = certificateContainer.offsetHeight;

    // Scale factor for positioning
    const scaleX = 842 / containerWidth;
    const scaleY = 595 / containerHeight;

    // Hide field controls for clean capture
    document.querySelectorAll(".field-controls").forEach((control) => {
      control.style.display = "none";
    });

    for (let i = 0; i < excelData.length; i++) {
      const data = excelData[i];

      // Create a temporary container for this certificate
      const tempContainer = certificateContainer.cloneNode(true);
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      document.body.appendChild(tempContainer);

      // Get fields container in cloned element
      const tempFieldsContainer =
        tempContainer.querySelector("#fields-container");

      // Clear fields and add dynamic content for this record
      tempFieldsContainer.innerHTML = "";

      // Add fields with data from Excel
      fieldPositions.forEach((pos) => {
        const fieldElement = document.createElement("div");
        fieldElement.classList.add("field");
        fieldElement.style.position = "absolute";
        fieldElement.style.left = `${pos.x}px`;
        fieldElement.style.top = `${pos.y}px`;

        // Apply styling
        fieldElement.style.fontFamily = pos.style.fontFamily;
        fieldElement.style.color = pos.style.color;
        fieldElement.style.fontSize = `${pos.style.fontSize}px`;
        fieldElement.style.fontWeight = pos.style.fontWeight;

        const contentDiv = document.createElement("div");
        contentDiv.classList.add("field-content");

        // Handle different field types
        if (
          pos.type === "signature" &&
          pos.signatureId &&
          signatures[pos.signatureId]
        ) {
          // For signature fields, use the uploaded signature image
          // We don't look up signature data from Excel
          const signatureImg = document.createElement("img");
          signatureImg.src = signatures[pos.signatureId];
          signatureImg.style.maxHeight = "60px";
          signatureImg.style.maxWidth = "100%";
          signatureImg.style.objectFit = "contain";
          contentDiv.appendChild(signatureImg);
        } else if (
          pos.label === "Signature" ||
          pos.label.toLowerCase().includes("sign")
        ) {
          // Also handle fields labeled "Signature" or containing "sign"
          // If there's a signatureId, use it, otherwise show placeholder
          if (pos.signatureId && signatures[pos.signatureId]) {
            const signatureImg = document.createElement("img");
            signatureImg.src = signatures[pos.signatureId];
            signatureImg.style.maxHeight = "60px";
            signatureImg.style.maxWidth = "100%";
            signatureImg.style.objectFit = "contain";
            contentDiv.appendChild(signatureImg);
          } else {
            // Just show a placeholder if no signature was uploaded
            contentDiv.innerHTML = `
                            <div class="signature-placeholder">
                                <i class="fas fa-signature"></i>
                                <span>Signature</span>
                            </div>
                        `;
          }
        } else {
          // Normal fields - get value from Excel data
          const value = data[pos.label] || pos.label;
          contentDiv.textContent = value;
        }

        fieldElement.appendChild(contentDiv);
        tempFieldsContainer.appendChild(fieldElement);
      });

      // Capture the certificate with data
      const canvas = await html2canvas(tempContainer, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // Higher quality rendering
      });

      // Add to PDF
      const imgData = canvas.toDataURL("image/png");
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, 842, 595);

      // Remove temp container
      document.body.removeChild(tempContainer);

      // Update progress
      loadingIndicator.innerHTML = `<div class="spinner"></div><p>Generating certificate ${
        i + 1
      } of ${excelData.length}...</p>`;
    }

    // Show controls again
    document.querySelectorAll(".field.selected").forEach((field) => {
      field.querySelector(".field-controls").style.display = "block";
    });

    // Generate PDF and download
    const pdfBlob = pdf.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    downloadLink.href = url;
    downloadLink.download = "Certificates.pdf";
    downloadLink.classList.remove("hidden");
    downloadLink.textContent = "Download Certificates";

    showNotification(
      `${excelData.length} certificates generated successfully!`,
      "success"
    );
  } catch (error) {
    console.error("Error generating certificates:", error);
    showNotification(
      "Error generating certificates: " + error.message,
      "error"
    );
  } finally {
    // Remove loading indicator
    document.body.removeChild(loadingIndicator);
  }
};

// This function adds a field to the certificate
window.addField = (label) => {
  const field = document.createElement("div");
  field.classList.add("field");
  field.dataset.label = label;
  field.dataset.type =
    label === "Signature" || label.toLowerCase().includes("sign")
      ? "signature"
      : "text";

  // Field content container
  const contentDiv = document.createElement("div");
  contentDiv.classList.add("field-content");

  if (field.dataset.type === "signature") {
    // For signature fields, add upload option and preview
    contentDiv.innerHTML = `
            <div class="signature-placeholder">
                <i class="fas fa-signature"></i>
                <span>Signature</span>
            </div>
            <input type="file" class="signature-upload hidden" accept="image/*">
        `;
    // Add click event to trigger file upload
    contentDiv
      .querySelector(".signature-placeholder")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isDragging) {
          contentDiv.querySelector(".signature-upload").click();
        }
      });

    // Handle signature upload
    contentDiv
      .querySelector(".signature-upload")
      .addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            // Create signature ID
            const signatureId = "sig_" + Date.now();
            field.dataset.signatureId = signatureId;

            // Store signature
            signatures[signatureId] = event.target.result;

            // Update preview
            const placeholder = contentDiv.querySelector(
              ".signature-placeholder"
            );
            placeholder.innerHTML = "";

            // Create an image element for better control
            const img = document.createElement("img");
            img.src = event.target.result;
            img.style.maxWidth = "100%";
            img.style.maxHeight = "60px";
            img.style.objectFit = "contain";
            placeholder.appendChild(img);

            saveFieldPositions();
          };
          reader.readAsDataURL(file);
        }
      });
  } else {
    contentDiv.textContent = label;
  }

  field.appendChild(contentDiv);

  // Apply current styling options
  field.style.fontFamily = fontSelector.value;
  field.style.color = colorPicker.value;
  field.style.fontSize = `${fontSizeInput.value}px`;
  field.style.fontWeight = boldToggle.checked ? "bold" : "normal";

  // Store styling with the field
  field.dataset.style = JSON.stringify({
    fontFamily: fontSelector.value,
    color: colorPicker.value,
    fontSize: fontSizeInput.value,
    fontWeight: boldToggle.checked ? "bold" : "normal",
  });

  // Control buttons container
  const controlsDiv = document.createElement("div");
  controlsDiv.classList.add(
    "field-controls",
    "absolute",
    "top-0",
    "right-0",
    "bg-white",
    "bg-opacity-80",
    "rounded",
    "p-1"
  );
  controlsDiv.style.display = "none"; // Hide controls by default

  // Edit button
  const editBtn = document.createElement("button");
  editBtn.innerHTML = '<i class="fa fa-edit"></i>';
  editBtn.classList.add("edit-btn", "text-blue-600", "mx-1");
  editBtn.title = "Edit Styling";
  editBtn.onclick = (e) => {
    e.stopPropagation();
    editFieldStyle(field);
  };

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.innerHTML = '<i class="fa fa-times"></i>';
  removeBtn.classList.add("remove-btn", "text-red-600", "mx-1");
  removeBtn.title = "Remove Field";
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    field.remove();
    saveFieldPositions();
  };

  controlsDiv.appendChild(editBtn);
  controlsDiv.appendChild(removeBtn);
  field.appendChild(controlsDiv);

  // Set initial position
  const containerRect = certificateContainer.getBoundingClientRect();
  field.style.left = `${containerRect.width / 2 - 60}px`;
  field.style.top = `${containerRect.height / 2 - 20}px`;

  fieldsContainer.appendChild(field);
  makeDraggable(field);

  // Select the newly added field
  selectField(field);

  saveFieldPositions();

  showNotification(`Field "${label}" added`, "success");
};




