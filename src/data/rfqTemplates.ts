export type RfqFlexibility = "EXACT_MATCH" | "OPEN_TO_EQUIVALENT" | "OPEN_TO_ALTERNATIVES";

export interface RfqTemplateItem {
  custom_item_description: string;
  quantity: number;
  flexibility: RfqFlexibility;
  special_notes?: string;
}

export interface RfqTemplate {
  key: string;
  label: string;
  category: string;
  description: string;
  delivery_location?: string;
  daysUntilRequired: number;
  notes: string;
  items: RfqTemplateItem[];
}

export const rfqTemplates: RfqTemplate[] = [
  {
    key: "office-consumables",
    label: "Office consumables",
    category: "Office Supplies",
    description: "Paper, pantry, cleaning, and daily workplace supplies.",
    daysUntilRequired: 10,
    notes: "Please quote commercial brands with delivery to our main office. Equivalent options are welcome when availability is faster.",
    items: [
      {
        custom_item_description: "A4 copy paper, 80 gsm, carton pack",
        quantity: 25,
        flexibility: "OPEN_TO_EQUIVALENT",
        special_notes: "Quote by carton and confirm sheets per carton.",
      },
      {
        custom_item_description: "Black ballpoint pens, box of 50",
        quantity: 10,
        flexibility: "OPEN_TO_EQUIVALENT",
      },
      {
        custom_item_description: "Disposable paper cups, 6 oz",
        quantity: 40,
        flexibility: "OPEN_TO_ALTERNATIVES",
      },
    ],
  },
  {
    key: "facility-maintenance",
    label: "Facility maintenance",
    category: "Facilities",
    description: "Maintenance consumables, tools, and replacement parts.",
    daysUntilRequired: 14,
    notes: "Please include technical datasheets or links for any equivalent products.",
    items: [
      {
        custom_item_description: "LED tube light, 120 cm, cool white",
        quantity: 80,
        flexibility: "OPEN_TO_EQUIVALENT",
        special_notes: "Include wattage and warranty period.",
      },
      {
        custom_item_description: "Heavy duty extension cable, 10 meter",
        quantity: 12,
        flexibility: "EXACT_MATCH",
      },
      {
        custom_item_description: "Industrial cleaning detergent, 5 liter",
        quantity: 30,
        flexibility: "OPEN_TO_ALTERNATIVES",
      },
    ],
  },
  {
    key: "it-accessories",
    label: "IT accessories",
    category: "IT",
    description: "Laptop peripherals, cables, and workspace hardware.",
    daysUntilRequired: 7,
    notes: "Please quote genuine products and include warranty terms where available.",
    items: [
      {
        custom_item_description: "USB-C docking station with HDMI and Ethernet",
        quantity: 15,
        flexibility: "OPEN_TO_EQUIVALENT",
      },
      {
        custom_item_description: "Wireless keyboard and mouse set",
        quantity: 20,
        flexibility: "OPEN_TO_EQUIVALENT",
      },
      {
        custom_item_description: "HDMI cable, 2 meter",
        quantity: 30,
        flexibility: "OPEN_TO_ALTERNATIVES",
      },
    ],
  },
];

export const getRfqTemplate = (key: string) => rfqTemplates.find((template) => template.key === key);
