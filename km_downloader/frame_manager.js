// Frame manager JavaScript
let frames = [];
let selectedFrames = new Set();
let draggedItem = null;
let title = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Get data from chrome storage
  const result = await chrome.storage.local.get(['frameData', 'videoTitle']);
  if (result.frameData && result.videoTitle) {
    frames = result.frameData;
    title = result.videoTitle;
    document.getElementById('title').textContent = `${title} - Frame Manager`;
    renderFrames();
    updateStats();
  } else {
    document.getElementById('framesContainer').innerHTML = '<div class="loading">No frame data found</div>';
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('selectAll').addEventListener('click', selectAll);
  document.getElementById('selectNone').addEventListener('click', selectNone);
  document.getElementById('deleteSelected').addEventListener('click', deleteSelected);
  document.getElementById('downloadPDF').addEventListener('click', downloadPDF);
  document.getElementById('cancel').addEventListener('click', cancel);
}

function renderFrames() {
  const container = document.getElementById('framesContainer');
  container.innerHTML = '';
  
  if (frames.length === 0) {
    container.innerHTML = '<div class="drop-zone">No frames to display</div>';
    return;
  }
  
  frames.forEach((frame, index) => {
    const frameItem = createFrameElement(frame, index);
    container.appendChild(frameItem);
  });
}

function createFrameElement(frame, index) {
  const frameDiv = document.createElement('div');
  frameDiv.className = 'frame-item';
  frameDiv.draggable = true;
  frameDiv.dataset.index = index;
  
  if (selectedFrames.has(index)) {
    frameDiv.classList.add('selected');
  }
  
  frameDiv.innerHTML = `
    <img src="${frame.url}" alt="Frame ${index + 1}" class="frame-image">
    <div class="frame-info">
      <div class="frame-number">Frame ${index + 1}</div>
      <div class="frame-time">Time: ${frame.time}s</div>
      <div class="frame-actions">
        <button class="move-btn move-up-btn" data-index="${index}">↑</button>
        <button class="move-btn move-down-btn" data-index="${index}">↓</button>
        <button class="delete-btn frame-delete-btn" data-index="${index}">Delete</button>
      </div>
    </div>
  `;
  
  // Add event listeners for buttons
  const moveUpBtn = frameDiv.querySelector('.move-up-btn');
  const moveDownBtn = frameDiv.querySelector('.move-down-btn');
  const deleteBtn = frameDiv.querySelector('.frame-delete-btn');
  
  moveUpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moveFrameUp(index);
  });
  
  moveDownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moveFrameDown(index);
  });
  
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteFrame(index);
  });
  
  // Add event listeners for frame interaction
  frameDiv.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      toggleSelection(index);
    }
  });
  
  frameDiv.addEventListener('dragstart', (e) => {
    draggedItem = index;
    frameDiv.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  
  frameDiv.addEventListener('dragend', () => {
    frameDiv.classList.remove('dragging');
    draggedItem = null;
  });
  
  frameDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  
  frameDiv.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedItem !== null && draggedItem !== index) {
      moveFrame(draggedItem, index);
    }
  });
  
  return frameDiv;
}

function toggleSelection(index) {
  if (selectedFrames.has(index)) {
    selectedFrames.delete(index);
  } else {
    selectedFrames.add(index);
  }
  renderFrames();
  updateStats();
}

function selectAll() {
  selectedFrames.clear();
  frames.forEach((_, index) => selectedFrames.add(index));
  renderFrames();
  updateStats();
}

function selectNone() {
  selectedFrames.clear();
  renderFrames();
  updateStats();
}

function deleteSelected() {
  if (selectedFrames.size === 0) {
    alert('No frames selected');
    return;
  }
  
  if (confirm(`Delete ${selectedFrames.size} selected frames?`)) {
    // Sort indices in descending order to avoid index shifting issues
    const indicesToDelete = Array.from(selectedFrames).sort((a, b) => b - a);
    
    indicesToDelete.forEach(index => {
      frames.splice(index, 1);
    });
    
    selectedFrames.clear();
    renderFrames();
    updateStats();
  }
}

function deleteFrame(index) {
  if (confirm('Delete this frame?')) {
    frames.splice(index, 1);
    selectedFrames.delete(index);
    
    // Update selected indices after deletion
    const newSelected = new Set();
    selectedFrames.forEach(i => {
      if (i > index) {
        newSelected.add(i - 1);
      } else if (i < index) {
        newSelected.add(i);
      }
    });
    selectedFrames = newSelected;
    
    renderFrames();
    updateStats();
  }
}

function moveFrame(fromIndex, toIndex) {
  const frame = frames.splice(fromIndex, 1)[0];
  frames.splice(toIndex, 0, frame);
  
  // Update selected indices
  const newSelected = new Set();
  selectedFrames.forEach(i => {
    if (i === fromIndex) {
      newSelected.add(toIndex);
    } else if (fromIndex < toIndex) {
      if (i > fromIndex && i <= toIndex) {
        newSelected.add(i - 1);
      } else {
        newSelected.add(i);
      }
    } else {
      if (i >= toIndex && i < fromIndex) {
        newSelected.add(i + 1);
      } else {
        newSelected.add(i);
      }
    }
  });
  selectedFrames = newSelected;
  
  renderFrames();
}

function moveFrameUp(index) {
  if (index > 0) {
    moveFrame(index, index - 1);
  }
}

function moveFrameDown(index) {
  if (index < frames.length - 1) {
    moveFrame(index, index + 1);
  }
}

function updateStats() {
  document.getElementById('frameCount').textContent = `${frames.length} frames`;
  document.getElementById('selectedCount').textContent = selectedFrames.size;
}

async function downloadPDF() {
  if (frames.length === 0) {
    alert('No frames to download');
    return;
  }
  
  // Create PDF directly in this page
  try {
    // Load pdf-lib if not already loaded
    if (typeof PDFLib === 'undefined') {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('libs/pdf-lib.min.js');
      document.head.appendChild(script);
      
      await new Promise(resolve => {
        script.onload = resolve;
      });
    }
    
    await createPDFDirectly();
  } catch (err) {
    console.error("Failed to create PDF:", err);
    alert("Failed to create PDF. Check console for details.");
  }
}

async function createPDFDirectly() {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  let successCount = 0;

  console.log(`Processing ${frames.length} frames...`);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      console.log(`Processing frame ${i + 1}/${frames.length}...`);
      
      // Convert data URL to blob
      const response = await fetch(frame.url);
      const blob = await response.blob();
      
      if (blob.size === 0) {
        console.warn(`Frame ${i + 1} is empty, skipping...`);
        continue;
      }

      const bytes = await blob.arrayBuffer();
      
      // Try to embed as JPEG first, fallback to PNG
      let img;
      try {
        img = await pdfDoc.embedJpg(bytes);
      } catch (jpgErr) {
        try {
          img = await pdfDoc.embedPng(bytes);
        } catch (pngErr) {
          console.error(`Failed to embed frame ${i + 1}:`, pngErr);
          continue;
        }
      }

      // Add page with image
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });
      successCount++;
      
    } catch (err) {
      console.error(`Error processing frame ${i + 1}:`, err);
    }
  }

  if (successCount === 0) {
    alert("No valid frames to include in the PDF.");
    return;
  }

  console.log('Generating PDF...');
  
  // Save PDF
  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(pdfBlob);

  // Send message to background to download
  chrome.runtime.sendMessage({
    action: "downloadPDF",
    url: blobUrl,
    filename: title + ".pdf"
  });

  console.log(`PDF created successfully with ${successCount} frames!`);
}

function cancel() {
  // Clear storage and close window
  chrome.storage.local.remove(['frameData', 'videoTitle']);
  window.close();
}