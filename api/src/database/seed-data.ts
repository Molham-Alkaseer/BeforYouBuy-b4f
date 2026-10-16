// Stored demo inputs only. Expiry offsets are relative to the household clock.
export const seedCategories = [
  {
    "id": 1,
    "name": "Dairy"
  },
  {
    "id": 2,
    "name": "Produce"
  },
  {
    "id": 3,
    "name": "Meat & Fish"
  },
  {
    "id": 4,
    "name": "Frozen"
  },
  {
    "id": 5,
    "name": "Grains & Pasta"
  },
  {
    "id": 6,
    "name": "Pantry staples"
  },
  {
    "id": 7,
    "name": "Drinks"
  }
];

export const seedPantry = [
  {
    "id": 1,
    "name": "Milk",
    "categoryId": 1,
    "quantity": 1,
    "unit": "litres",
    "minimumQuantity": 2,
    "expiryOffset": 2
  },
  {
    "id": 2,
    "name": "Yoghurt",
    "categoryId": 1,
    "quantity": 2,
    "unit": "pots",
    "minimumQuantity": 3,
    "expiryOffset": -1
  },
  {
    "id": 3,
    "name": "Cream cheese",
    "categoryId": 1,
    "quantity": 1,
    "unit": "tubs",
    "minimumQuantity": 1,
    "expiryOffset": -3
  },
  {
    "id": 4,
    "name": "Butter",
    "categoryId": 1,
    "quantity": 2,
    "unit": "packs",
    "minimumQuantity": 1,
    "expiryOffset": 40
  },
  {
    "id": 5,
    "name": "Cheddar",
    "categoryId": 1,
    "quantity": 1,
    "unit": "blocks",
    "minimumQuantity": 1,
    "expiryOffset": 12
  },
  {
    "id": 6,
    "name": "Eggs",
    "categoryId": 1,
    "quantity": 4,
    "unit": "pieces",
    "minimumQuantity": 6,
    "expiryOffset": 9
  },
  {
    "id": 7,
    "name": "Spinach",
    "categoryId": 2,
    "quantity": 1,
    "unit": "bags",
    "minimumQuantity": 1,
    "expiryOffset": 3
  },
  {
    "id": 8,
    "name": "Tomatoes",
    "categoryId": 2,
    "quantity": 6,
    "unit": "pieces",
    "minimumQuantity": 4,
    "expiryOffset": 5
  },
  {
    "id": 9,
    "name": "Apples",
    "categoryId": 2,
    "quantity": 8,
    "unit": "pieces",
    "minimumQuantity": 4,
    "expiryOffset": 9
  },
  {
    "id": 10,
    "name": "Carrots",
    "categoryId": 2,
    "quantity": 1.5,
    "unit": "kg",
    "minimumQuantity": 1,
    "expiryOffset": 14
  },
  {
    "id": 11,
    "name": "Chicken breast",
    "categoryId": 3,
    "quantity": 0.8,
    "unit": "kg",
    "minimumQuantity": 0.5,
    "expiryOffset": 1
  },
  {
    "id": 12,
    "name": "Salmon fillets",
    "categoryId": 4,
    "quantity": 2,
    "unit": "pieces",
    "minimumQuantity": 2,
    "expiryOffset": 60
  },
  {
    "id": 13,
    "name": "Rice",
    "categoryId": 5,
    "quantity": 4,
    "unit": "kg",
    "minimumQuantity": 2,
    "expiryOffset": null
  },
  {
    "id": 14,
    "name": "Pasta",
    "categoryId": 5,
    "quantity": 3,
    "unit": "packs",
    "minimumQuantity": 2,
    "expiryOffset": null
  },
  {
    "id": 15,
    "name": "Lentils",
    "categoryId": 5,
    "quantity": 0.5,
    "unit": "kg",
    "minimumQuantity": 1,
    "expiryOffset": null
  },
  {
    "id": 16,
    "name": "Olive oil",
    "categoryId": 6,
    "quantity": 0.3,
    "unit": "litres",
    "minimumQuantity": 0.5,
    "expiryOffset": 200
  },
  {
    "id": 17,
    "name": "Flour",
    "categoryId": 6,
    "quantity": 2,
    "unit": "kg",
    "minimumQuantity": 1,
    "expiryOffset": 120
  },
  {
    "id": 18,
    "name": "Sugar",
    "categoryId": 6,
    "quantity": 1,
    "unit": "kg",
    "minimumQuantity": 1,
    "expiryOffset": null
  },
  {
    "id": 19,
    "name": "Orange juice",
    "categoryId": 7,
    "quantity": 2,
    "unit": "litres",
    "minimumQuantity": 1,
    "expiryOffset": 10
  },
  {
    "id": 20,
    "name": "Green tea",
    "categoryId": 7,
    "quantity": 20,
    "unit": "bags",
    "minimumQuantity": 10,
    "expiryOffset": 300
  }
];
