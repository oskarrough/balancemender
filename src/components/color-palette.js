class ColorPalette extends HTMLElement {
  constructor() {
    super()
    this.colorPrefix = '--c-';
  }

  connectedCallback() {
    this.renderColorGrid();
  }

  renderColorGrid() {
    // Clear any existing swatches
    this.innerHTML = ''
    
    // Use hardcoded list of colors
    const colors = this.getColorVariables()
    console.log(`Found ${colors.length} color variables`)
    
    // Create swatches for each color
    colors.forEach(colorName => {
      const fullVarName = `var(${colorName})`
      const displayName = colorName.replace(this.colorPrefix, '').replace('-', ' ')
      
      const swatch = document.createElement('div')
      swatch.className = 'color-swatch'
      swatch.style.backgroundColor = fullVarName
      swatch.dataset.colorName = displayName
      
      // Click to copy the color variable name
      swatch.addEventListener('click', () => {
        navigator.clipboard.writeText(colorName)
          .then(() => {
            swatch.style.outline = '2px solid white'
            setTimeout(() => swatch.style.outline = 'none', 500)
          })
          .catch(err => console.error('Could not copy text: ', err))
      })
      
      this.appendChild(swatch)
    })
  }

  getColorVariables() {
    // Just return all the color variables we know exist in colors.css
    return [
      '--c-lemon-yellow',
      '--c-permanent-yellow',
      '--c-chrome-yellow',
      '--c-chrome-yellow-deep',
      '--c-marigold',
      '--c-orange',
      '--c-scarlet-lake',
      '--c-vermilion',
      '--c-carmine',
      '--c-crimson-lake',
      '--c-coral',
      '--c-rose-red',
      '--c-opera',
      '--c-magenta',
      '--c-brilliant-rose',
      '--c-pink',
      '--c-violet-pale',
      '--c-cobalt-violet',
      '--c-mauve',
      '--c-iris-blue',
      '--c-heliotrope',
      '--c-ultramarine',
      '--c-prussian-blue',
      '--c-cobalt-blue',
      '--c-indigo',
      '--c-french-blue',
      '--c-blue-celeste',
      '--c-marine-blue',
      '--c-french-grey',
      '--c-sky-blue',
      '--c-cerulean-blue',
      '--c-light-blue',
      '--c-blue-gray',
      '--c-compose-blue',
      '--c-turkey-green',
      '--c-viridian',
      '--c-chrome-green-3',
      '--c-cobalt-green',
      '--c-emerald-green',
      '--c-chrome-green-2',
      '--c-imperial-green',
      '--c-light-green',
      '--c-sap-green',
      '--c-chrome-green-1',
      '--c-linden-green',
      '--c-naples-yellow',
      '--c-raw-umber',
      '--c-yellow-ochre',
      '--c-jaune-brilliant',
      '--c-sepia',
      '--c-burnt-umber',
      '--c-burnt-sienna',
      '--c-chocolate',
      '--c-purple-lake',
      '--c-olive-green',
      '--c-snow-white',
      '--c-white',
      '--c-b-black',
      '--c-black'
    ]
  }
}

// Register the component
customElements.define('color-palette', ColorPalette) 