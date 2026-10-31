export const themes = {
  light: {
    overlay: '#00000066', background: '#FAFBF8', surface: '#F0F3EB', text: '#202B24', muted: '#626E5C',
    accent: '#263F34', onAccent: '#FFFFFF', link: '#38562E', placeholder: '#626E5C',
    border: '#DDE3D6', divider: '#EAEDE5', activeTab: '#FFFFFF', selected: '#E4ECD8', selectedBorder: '#9DAF8F',
    summary: '#E9EFDE', summaryText: '#253C2A', summaryMuted: '#4F624A', summaryBorder: '#CDD8C0', summaryControl: '#DDE7CE',
    progress: '#476740', danger: '#A13D32', categoryText: '#4D594E',
    categories: { Food: '#F5EADD', Transport: '#E3ECF5', Shopping: '#EEE5F3', Bills: '#F5E3DE', Other: '#E8ECE8' },
  },
  dark: {
    overlay: '#00000099', background: '#121A16', surface: '#202C24', text: '#EDF3E9', muted: '#AFBDAC',
    accent: '#B4CDA0', onAccent: '#172415', link: '#B4CDA0', placeholder: '#A3B09D',
    border: '#3B493D', divider: '#2C392F', activeTab: '#3B503E', selected: '#354C35', selectedBorder: '#88A875',
    summary: '#253A2C', summaryText: '#E5F1D9', summaryMuted: '#BECEB5', summaryBorder: '#485E45', summaryControl: '#354D36',
    progress: '#B4CDA0', danger: '#FFB4A8', categoryText: '#DFE8DB',
    categories: { Food: '#493B2B', Transport: '#2B3E50', Shopping: '#44334D', Bills: '#4B342F', Other: '#354039' },
  },
};
export type Theme = typeof themes.light;
