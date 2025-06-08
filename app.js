/* app.js - Enhanced Pokémon Collection Trader with Fixed Theme Toggle */

// --- Constants and Utilities ---
const GENERATIONS = [
  { id: 1, name: "Kanto", range: [1, 151], color: "#d20f39" },
  { id: 2, name: "Johto", range: [152, 251], color: "#df8e1d" },
  { id: 3, name: "Hoenn", range: [252, 386], color: "#04a5e5" },
  { id: 4, name: "Sinnoh", range: [387, 494], color: "#209fb5" },
  { id: 5, name: "Unova", range: [495, 649], color: "#7c7f93" },
  { id: 6, name: "Kalos", range: [650, 721], color: "#7287fd" },
  { id: 7, name: "Alola", range: [722, 809], color: "#fe640b" },
  { id: 8, name: "Galar", range: [810, 898], color: "#179299" }
];

// API and caching config
const POKE_API_BASE = 'https://pokeapi.co/api/v2/pokemon/';
const POKE_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const POKE_ANIMATED_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/';
const POKEMON_NAMES_CACHE = {};
const API_LOADING_CACHE = {};
let CURRENT_POKEMON_NAMES = {}; // To avoid re-fetching during a session

// DOM Element References
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileNameDisplay = document.getElementById('fileName');
const processingResults = document.getElementById('processingResults');
const totalCountEl = document.getElementById('totalCount');
const duplicatesCountEl = document.getElementById('duplicatesCount');
const missingCountEl = document.getElementById('missingCount');
const combinedExportEl = document.getElementById('combinedExport');
const compactModeCheckbox = document.getElementById('compactMode');
const copyBtn = document.getElementById('copyCombined');
const downloadBtn = document.getElementById('downloadCombined');
const yourCombinedEl = document.getElementById('yourCombined');
const partnerCombinedEl = document.getElementById('partnerCombined');
const analyzeBtn = document.getElementById('analyzeComparison');
const clearBtn = document.getElementById('clearComparison');
const resultsContentEl = document.getElementById('resultsContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const creatorNameEl = document.getElementById('creatorName');
const themeToggleBtn = document.getElementById('themeToggle');
const viewOffersBtn = document.getElementById('viewOffers');
const viewWantsBtn = document.getElementById('viewWants');
const useGifsCheckbox = document.getElementById('useGifs');
const expandAllCheckbox = document.getElementById('expandAll');

// --- Theme Handling (FIXED) ---
function initializeTheme() {
  // Get saved theme or default to system preference
  const savedTheme = localStorage.getItem('pokemonTraderTheme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  
  // Apply theme
  document.documentElement.setAttribute('data-theme', initialTheme);
  updateThemeIcon(initialTheme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Apply new theme
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('pokemonTraderTheme', newTheme);
  updateThemeIcon(newTheme);
}

// --- Pokemon Name and Sprite Utilities ---
// Batch load Pokemon names to avoid too many API calls
async function batchLoadPokemonNames(ids) {
  const uniqueIds = [...new Set(ids)].filter(id => !CURRENT_POKEMON_NAMES[id]);
  const batches = [];
  
  // Split into batches of 20 IDs
  for (let i = 0; i < uniqueIds.length; i += 20) {
    batches.push(uniqueIds.slice(i, i + 20));
  }
  
  for (const batch of batches) {
    await Promise.all(batch.map(id => loadPokemonName(id)));
  }
}

async function loadPokemonName(id) {
  // Return cached name if available
  if (CURRENT_POKEMON_NAMES[id]) {
    return CURRENT_POKEMON_NAMES[id];
  }
  
  // Avoid multiple concurrent requests for the same Pokemon
  if (API_LOADING_CACHE[id]) {
    return API_LOADING_CACHE[id];
  }
  
  // Try localStorage first
  const storedName = localStorage.getItem(`pokemon_name_${id}`);
  if (storedName) {
    CURRENT_POKEMON_NAMES[id] = storedName;
    return storedName;
  }
  
  // Create promise for loading from API
  API_LOADING_CACHE[id] = (async () => {
    try {
      const response = await fetch(`${POKE_API_BASE}${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const name = data.name.charAt(0).toUpperCase() + data.name.slice(1);
      
      // Cache the result
      CURRENT_POKEMON_NAMES[id] = name;
      localStorage.setItem(`pokemon_name_${id}`, name);
      delete API_LOADING_CACHE[id];
      
      // Update UI if needed
      updatePokemonNameInUI(id, name);
      
      return name;
    } catch (error) {
      console.warn(`Failed to load Pokemon #${id}:`, error);
      // Cache fallback name to avoid repeated failed requests
      const fallbackName = `Pokémon #${id}`;
      CURRENT_POKEMON_NAMES[id] = fallbackName;
      delete API_LOADING_CACHE[id];
      
      return fallbackName;
    }
  })();

  return API_LOADING_CACHE[id];
}

function updatePokemonNameInUI(id, name) {
  document.querySelectorAll(`[data-pokemon-id="${id}"] .pokemon-name`).forEach(el => {
    el.textContent = name || CURRENT_POKEMON_NAMES[id] || `Pokémon #${id}`;
  });
}

function getPokemonName(id) {
  // Use already loaded name or placeholder
  return CURRENT_POKEMON_NAMES[id] || `Pokémon #${id}`;
}

function getSpriteUrl(id, animated = false) {
  if (animated) {
    return `${POKE_ANIMATED_BASE}${id}.gif`;
  }
  return `${POKE_SPRITE_BASE}${id}.png`;
}

function getGeneration(id) {
  return GENERATIONS.find(gen => id >= gen.range[0] && id <= gen.range[1]);
}

// --- Tab Navigation ---
function initializeTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active states
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
      
      // Auto-fill on compare tab
      if (btn.dataset.tab === 'compare') {
        autoFillUserData();
      }
    });
  });
}

// --- Results View Controls ---
function initializeResultsControls() {
  viewOffersBtn.addEventListener('click', () => {
    viewOffersBtn.classList.add('active');
    viewWantsBtn.classList.remove('active');
    document.querySelectorAll('.view-offers-section').forEach(s => s.classList.add('active'));
    document.querySelectorAll('.view-wants-section').forEach(s => s.classList.remove('active'));
  });
  
  viewWantsBtn.addEventListener('click', () => {
    viewWantsBtn.classList.add('active');
    viewOffersBtn.classList.remove('active');
    document.querySelectorAll('.view-wants-section').forEach(s => s.classList.add('active'));
    document.querySelectorAll('.view-offers-section').forEach(s => s.classList.remove('active'));
  });
  
  useGifsCheckbox.addEventListener('change', () => {
    const isAnimated = useGifsCheckbox.checked;
    document.querySelectorAll('.pokemon-sprite').forEach(sprite => {
      const id = sprite.closest('.pokemon-card').dataset.pokemonId;
      sprite.src = getSpriteUrl(id, isAnimated);
    });
    localStorage.setItem('useAnimatedSprites', isAnimated ? 'true' : 'false');
  });
  
  expandAllCheckbox.addEventListener('change', () => {
    const shouldExpandAll = expandAllCheckbox.checked;
    document.querySelectorAll('.generation-content').forEach(content => {
      content.classList.toggle('collapsed', !shouldExpandAll);
    });
    document.querySelectorAll('.generation-toggle').forEach(toggle => {
      toggle.textContent = shouldExpandAll ? '−' : '+';
    });
  });
  
  // Initialize from localStorage
  const savedUseGifs = localStorage.getItem('useAnimatedSprites');
  if (savedUseGifs !== null) {
    useGifsCheckbox.checked = savedUseGifs === 'true';
  }
}

// --- File Upload Handling ---
function initializeFileUpload() {
  // File selection via button
  uploadArea.addEventListener('click', () => fileInput.click());

  // Drag and drop functionality
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelection();
    }
  });

  // Regular file input change
  fileInput.addEventListener('change', handleFileSelection);
}

function handleFileSelection() {
  const file = fileInput.files[0];
  if (!file) return;
  
  // Show selected filename
  fileNameDisplay.textContent = file.name;
  
  // Show loading spinner
  loadingOverlay.classList.remove('hidden');
  
  // Process the file
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const json = JSON.parse(e.target.result);
      setTimeout(() => {
        processCollectionData(json);
        loadingOverlay.classList.add('hidden');
      }, 800); // Simulate processing time for visual feedback
    } catch (err) {
      loadingOverlay.classList.add('hidden');
      showToast('Invalid JSON file. Please check the format and try again.', 'error');
    }
  };
  reader.onerror = function() {
    loadingOverlay.classList.add('hidden');
    showToast('Error reading the file. Please try again.', 'error');
  };
  reader.readAsText(file);
}

// --- Data Processing ---
function processCollectionData(data) {
  // Extract IDs from collection
  const owned = data.map(p => Number(p.id));
  const totalCount = owned.length;
  
  // Find duplicates
  const idCounts = {};
  data.forEach(p => {
    const id = Number(p.id);
    idCounts[id] = (idCounts[id] || 0) + 1;
  });
  const duplicates = Object.entries(idCounts)
    .filter(([_, count]) => count > 1)
    .map(([id]) => Number(id));
  
  // Starters to exclude from missing calculations
  const starterIds = [
    1, 4, 7, 152, 155, 158, 252, 255, 258, 
    387, 390, 393, 495, 498, 501, 650, 653, 656, 
    722, 725, 728, 810, 813, 816
  ];
  
  // Find missing Pokémon (excluding starters) up to gen 8
  const maxId = 898;
  const missing = [];
  for (let i = 1; i <= maxId; i++) {
    if (!owned.includes(i) && !starterIds.includes(i)) {
      missing.push(i);
    }
  }
  
  // Update stats display with animation
  animateNumber(totalCountEl, totalCount);
  animateNumber(duplicatesCountEl, duplicates.length);
  animateNumber(missingCountEl, missing.length);
  
  // Create combined export
  updateExport(duplicates, missing);
  
  // Show results
  processingResults.classList.remove('hidden');
  
  // Preload Pokemon names for duplicates
  batchLoadPokemonNames([...duplicates, ...missing.slice(0, 50)]);
}

function updateExport(duplicates, missing) {
  const exportObj = { duplicates, missing };
  let exportStr;
  
  if (compactModeCheckbox.checked) {
    // Compact format (single line JSON)
    exportStr = JSON.stringify(exportObj);
  } else {
    // Pretty format with indentation
    exportStr = JSON.stringify(exportObj, null, 2);
  }
  
  combinedExportEl.value = exportStr;
  
  // Save to localStorage for later use
  localStorage.setItem('pokemonTradeCombined', exportStr);
}

// Toggle export format when compact mode is changed
compactModeCheckbox.addEventListener('change', () => {
  try {
    const currentData = JSON.parse(combinedExportEl.value);
    updateExport(currentData.duplicates, currentData.missing);
  } catch (e) {
    // If parsing fails, do nothing
    console.error('Failed to reformat export data', e);
  }
});

// --- Copy and Download Functionality ---
function initializeExportControls() {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(combinedExportEl.value);
      showToast('Export copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      combinedExportEl.select();
      document.execCommand('copy');
      showToast('Export copied to clipboard!');
    }
  });

  downloadBtn.addEventListener('click', () => {
    const text = combinedExportEl.value;
    if (!text) return;
    
    const blob = new Blob([text], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pokemon_trade_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Export file downloaded!');
  });
}

// --- Comparison Tab ---
function autoFillUserData() {
  const savedData = localStorage.getItem('pokemonTradeCombined');
  if (savedData) {
    yourCombinedEl.value = savedData;
  }
}

function initializeComparisonControls() {
  analyzeBtn.addEventListener('click', () => {
    const yourText = yourCombinedEl.value.trim();
    const partnerText = partnerCombinedEl.value.trim();
    
    if (!yourText || !partnerText) {
      showToast('Please fill in both export fields.');
      return;
    }
    
    try {
      const yourData = JSON.parse(yourText);
      const partnerData = JSON.parse(partnerText);
      
      // Validate exported data
      if (!yourData.duplicates || !yourData.missing || !partnerData.duplicates || !partnerData.missing) {
        showToast('Invalid export data format.');
        return;
      }
      
      analyzeTradeOpportunities(yourData, partnerData);
      
      // Switch to results tab
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="results"]').classList.add('active');
      document.getElementById('results-tab').classList.add('active');
      
    } catch (err) {
      showToast('Invalid JSON data. Please check the exports and try again.');
    }
  });

  clearBtn.addEventListener('click', () => {
    yourCombinedEl.value = '';
    partnerCombinedEl.value = '';
    showToast('Fields cleared!');
  });
}

// --- Results Display ---
function analyzeTradeOpportunities(yourData, partnerData) {
  // Show loading while we process
  loadingOverlay.classList.remove('hidden');
  
  // You can offer: your duplicates ∩ partner missing
  const offerIds = yourData.duplicates.filter(id => partnerData.missing.includes(id));
  
  // You want: partner duplicates ∩ your missing
  const wantIds = partnerData.duplicates.filter(id => yourData.missing.includes(id));
  
  // Preload Pokemon names
  batchLoadPokemonNames([...offerIds, ...wantIds])
    .then(() => {
      // Group by generation
      const offersByGen = groupByGeneration(offerIds);
      const wantsByGen = groupByGeneration(wantIds);
      
      // Display results
      displayResults(offersByGen, wantsByGen);
      
      // Hide loading
      loadingOverlay.classList.add('hidden');
    });
}

function groupByGeneration(pokemonIds) {
  const grouped = {};
  
  GENERATIONS.forEach(gen => {
    grouped[gen.id] = {
      name: gen.name,
      color: gen.color,
      pokemon: []
    };
  });
  
  pokemonIds.forEach(id => {
    const gen = getGeneration(id);
    if (gen) {
      grouped[gen.id].pokemon.push(id);
    }
  });
  
  return grouped;
}

function displayResults(offersByGen, wantsByGen) {
  resultsContentEl.innerHTML = '';
  
  const hasOffers = Object.values(offersByGen).some(gen => gen.pokemon.length > 0);
  const hasWants = Object.values(wantsByGen).some(gen => gen.pokemon.length > 0);
  
  if (!hasOffers && !hasWants) {
    resultsContentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💫</div>
        <p>No trading opportunities found. Try comparing with a different partner.</p>
      </div>
    `;
    return;
  }
  
  // Create container for each view (offers/wants)
  const offersContainer = document.createElement('div');
  offersContainer.className = 'view-offers-section active';
  
  const wantsContainer = document.createElement('div');
  wantsContainer.className = 'view-wants-section';
  
  resultsContentEl.appendChild(offersContainer);
  resultsContentEl.appendChild(wantsContainer);
  
  // Create generation sections for each view
  GENERATIONS.forEach(gen => {
    const offersInGen = offersByGen[gen.id].pokemon;
    const wantsInGen = wantsByGen[gen.id].pokemon;
    
    // Skip if no Pokémon in this generation for both views
    if (offersInGen.length === 0 && wantsInGen.length === 0) {
      return;
    }
    
    // "You Can Offer" view section
    if (offersInGen.length > 0) {
      const offerSection = createGenerationSection(gen, offersInGen, 'offer');
      offersContainer.appendChild(offerSection);
    }
    
    // "You Want" view section
    if (wantsInGen.length > 0) {
      const wantSection = createGenerationSection(gen, wantsInGen, 'want');
      wantsContainer.appendChild(wantSection);
    }
  });
  
  // Add event listeners for generation toggling
  document.querySelectorAll('.generation-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const toggle = header.querySelector('.generation-toggle');
      
      content.classList.toggle('collapsed');
      toggle.textContent = content.classList.contains('collapsed') ? '+' : '−';
    });
  });
}

function createGenerationSection(generation, pokemonIds, type) {
  const section = document.createElement('div');
  section.className = `generation-section gen${generation.id}`;
  
  const isExpanded = expandAllCheckbox.checked;
  
  // Create header
  const header = document.createElement('div');
  header.className = 'generation-header';
  header.innerHTML = `
    <div class="generation-info">
      <span class="generation-indicator" style="background-color: ${generation.color}"></span>
      <h3>Generation ${generation.id}: ${generation.name} (${pokemonIds.length})</h3>
    </div>
    <span class="generation-toggle">${isExpanded ? '−' : '+'}</span>
  `;
  
  // Create content
  const content = document.createElement('div');
  content.className = `generation-content ${isExpanded ? '' : 'collapsed'}`;
  
  // Create Pokemon grid
  const pokemonGrid = document.createElement('div');
  pokemonGrid.className = 'pokemon-grid';
  
  // Create Pokemon cards
  const useAnimated = useGifsCheckbox.checked;
  pokemonIds.forEach(id => {
    pokemonGrid.appendChild(createPokemonCard(id, generation.id, useAnimated));
  });
  
  content.appendChild(pokemonGrid);
  
  // Add to section
  section.appendChild(header);
  section.appendChild(content);
  
  return section;
}

function createPokemonCard(id, genId, useAnimated = false) {
  const card = document.createElement('div');
  card.className = 'pokemon-card';
  card.dataset.pokemonId = id;
  
  // Create sprite
  const sprite = document.createElement('img');
  sprite.className = 'pokemon-sprite';
  sprite.src = getSpriteUrl(id, useAnimated);
  sprite.alt = `Pokémon #${id}`;
  sprite.loading = 'lazy';
  sprite.onerror = function() {
    // Fallback to static sprite if GIF fails to load
    if (useAnimated) {
      this.src = getSpriteUrl(id, false);
    }
  };
  
  // Create name element
  const name = document.createElement('div');
  name.className = 'pokemon-name';
  name.textContent = getPokemonName(id);
  
  // Create ID element
  const idEl = document.createElement('div');
  idEl.className = 'pokemon-id';
  idEl.textContent = `#${id}`;
  
  // Create gen badge
  const badge = document.createElement('span');
  badge.className = `gen-badge gen-badge-${genId}`;
  badge.textContent = `Gen ${genId}`;
  
  // Assemble card
  card.appendChild(sprite);
  card.appendChild(name);
  card.appendChild(idEl);
  card.appendChild(badge);
  
  return card;
}

// --- Animation Utilities ---
function animateNumber(element, target, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  
  function updateNumber(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    const value = Math.floor(progress * (target - start) + start);
    
    element.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }
  
  requestAnimationFrame(updateNumber);
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// --- Creator Name Customization ---
function initializeFooter() {
  // Initialize from localStorage
  const savedCreatorName = localStorage.getItem('creatorName');
  if (savedCreatorName) {
    creatorNameEl.textContent = savedCreatorName;
  }
  
  // Allow editing the creator name
  creatorNameEl.addEventListener('click', function() {
    const currentName = this.textContent;
    const newName = prompt('Enter your name(s):', currentName);
    if (newName !== null && newName.trim() !== '') {
      this.textContent = newName;
      localStorage.setItem('creatorName', newName);
    }
  });
}

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme first
  initializeTheme();
  
  // Set up theme toggle event listener
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  
  // Initialize all other components
  initializeTabs();
  initializeFileUpload();
  initializeExportControls();
  initializeComparisonControls();
  initializeResultsControls();
  initializeFooter();
  
  console.log('Pokémon Collection Trader initialized with Catppuccin theme and working dark/light toggle!');
});

