#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// OLED setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// I2C pins
#define SDA_PIN 21
#define SCL_PIN 22

// Button pins
#define BUTTON_1 12 // Main Menu/Reset/Return (long press for cart)
#define BUTTON_2 13 // Select/Add/Confirm Order (double press for order)
#define BUTTON_3 14 // Scroll Up/Increment
#define BUTTON_4 15 // Scroll Down/Decrement

// Hardcoded table number
#define TABLE_NUMBER 8

// Menu items
const char* menuItems[] = {"Burger", "Pizza", "Salad", "Pasta", "Drink"};
const int menuSize = 5;
const float itemPrices[] = {5.99, 10.99, 4.99, 8.99, 2.99}; // Prices for each item
int currentMenuIndex = 0;
int currentQuantity = 1;
int cartScrollIndex = 0;
bool inQuantityMode = false;
bool inCartView = false;
bool inConfirmMode = false;
bool inWelcomeScreen = true;

// Cart to store orders
struct OrderItem {
  String item;
  int quantity;
};
OrderItem cart[10]; // Max 10 items in cart
int cartSize = 0;

// Button debouncing and press detection
unsigned long lastButton2Release = 0;
unsigned long lastButton1Press = 0;
const unsigned long longPressDuration = 1000; // 1 second for long press
const unsigned long doublePressInterval = 500; // 500ms for double press
bool waitingForSecondPress = false;

void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  Serial.println("System Initialized");

  // Initialize I2C and OLED
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED initialization failed");
    for(;;);
  }

  // Initialize buttons with internal pull-ups
  pinMode(BUTTON_1, INPUT_PULLUP);
  pinMode(BUTTON_2, INPUT_PULLUP);
  pinMode(BUTTON_3, INPUT_PULLUP);
  pinMode(BUTTON_4, INPUT_PULLUP);

  // Show welcome screen
  displayWelcomeScreen();
}

void displayWelcomeScreen() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 10);
  display.println("Welcome!");
  display.setTextSize(1);
  display.setCursor(10, 40);
  display.println("Press Btn 1 to start");
  display.display();
  Serial.println("Welcome screen displayed");
}

void displayMenu() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("=== Menu ===");
  for (int i = 0; i < menuSize; i++) {
    display.setCursor(0, 10 + i * 10);
    if (i == currentMenuIndex) {
      display.print("> ");
    } else {
      display.print("  ");
    }
    display.println(menuItems[i]);
  }
  display.setCursor(0, 60);
  display.println("Btn 2 x2: Order");
  display.display();
  Serial.println("Menu displayed, current index: " + String(currentMenuIndex));
}

void displayQuantityDialog() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("=== Quantity ===");
  display.setCursor(0, 20);
  display.print(menuItems[currentMenuIndex]);
  display.print(": ");
  display.println(currentQuantity);
  display.setCursor(0, 40);
  display.println("Btn 2: Add to Cart");
  display.display();
  Serial.println("Quantity dialog for " + String(menuItems[currentMenuIndex]) + ": " + String(currentQuantity));
}

void displayCart() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("=== Cart ===");
  if (cartSize == 0) {
    display.setCursor(0, 20);
    display.println("Cart is Empty");
  } else {
    // Display up to 4 items starting from cartScrollIndex
    for (int i = cartScrollIndex; i < min(cartScrollIndex + 4, cartSize); i++) {
      display.setCursor(0, 10 + (i - cartScrollIndex) * 10);
      display.print(cart[i].item);
      display.print(" x");
      display.println(cart[i].quantity);
    }
  }
  display.setCursor(0, 50);
  display.println("Btn 1: Back  Btn 2 x2: Order");
  display.display();
  Serial.println("Cart view displayed, scroll index: " + String(cartScrollIndex));
}

void displayNotification(String message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 20);
  display.println(message);
  display.display();
  Serial.println("Notification: " + message);
  delay(1000); // Show notification for 1 second
}

void displayConfirmDialog() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("=== Confirm ===");
  display.setCursor(0, 20);
  display.println("Confirm Order?");
  display.setCursor(0, 40);
  display.println("Btn 2: Yes  Btn 1: No");
  display.display();
  Serial.println("Confirm order dialog displayed");
}

void addToCart() {
  if (cartSize < 10) {
    cart[cartSize].item = menuItems[currentMenuIndex];
    cart[cartSize].quantity = currentQuantity;
    cartSize++;
    displayNotification("Added to Cart!");
    Serial.println("Added to cart: " + String(menuItems[currentMenuIndex]) + " x" + String(currentQuantity));
  } else {
    displayNotification("Cart Full!");
    Serial.println("Cart full, cannot add item");
  }
  currentQuantity = 1;
  inQuantityMode = false;
  inCartView = false; // Ensure cart view is exited
  displayMenu();
}

void submitOrder() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 20);
  display.println("Order Sent!");
  display.display();
  
  // Simulate POST request
  Serial.println("POST http://localhost:8000/orders");
  Serial.println("Content-Type: application/json");
  Serial.println();
  
  // Construct JSON payload
  String json = "{\n  \"TableNumber\": " + String(TABLE_NUMBER) + ",\n  \"Items\": [";
  for (int i = 0; i < cartSize; i++) {
    // Find ItemID (1-based index of menu item)
    int itemID = 0;
    for (int j = 0; j < menuSize; j++) {
      if (cart[i].item == menuItems[j]) {
        itemID = j + 1;
        break;
      }
    }
    json += "\n    {";
    json += "\n      \"ItemID\": " + String(itemID) + ",";
    json += "\n      \"Name\": \"" + cart[i].item + "\",";
    json += "\n      \"Quantity\": " + String(cart[i].quantity) + ",";
    json += "\n      \"Price\": " + String(itemPrices[itemID -1], 2);
    json += "\n    }";
    if (i < cartSize - 1) json += ",";
  }
  json += "\n  ]\n}";
  Serial.println(json);

  // Reset cart
  cartSize = 0;
  inConfirmMode = false;
  inCartView = false;
  cartScrollIndex = 0;
  delay(2000); // Show "Order Sent" for 2 seconds
  displayMenu();
}

void resetOrder() {
  cartSize = 0;
  currentMenuIndex = 0;
  currentQuantity = 1;
  cartScrollIndex = 0;
  inQuantityMode = false;
  inCartView = false;
  inConfirmMode = false;
  inWelcomeScreen = false;
  displayMenu();
  Serial.println("Order reset");
}

void loop() {
  // Button 1: Reset/Return to Menu/Cancel Confirmation (long press for cart)
  if (digitalRead(BUTTON_1) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_1) == LOW) {
      unsigned long pressStart = millis();
      while (digitalRead(BUTTON_1) == LOW) {
        if (millis() - pressStart >= longPressDuration && !inConfirmMode && !inWelcomeScreen) {
          // Long press: Show cart
          inCartView = true;
          inQuantityMode = false;
          inConfirmMode = false;
          cartScrollIndex = 0;
          displayCart();
          while (digitalRead(BUTTON_1) == LOW); // Wait for release
          return;
        }
      }
      // Short press handling
      if (inWelcomeScreen) {
        resetOrder();
      } else if (inConfirmMode) {
        inConfirmMode = false;
        inCartView = false;
        displayMenu();
        Serial.println("Order confirmation cancelled");
      } else if (inCartView) {
        inCartView = false;
        inConfirmMode = false;
        displayMenu();
        Serial.println("Returned to menu from cart view");
      } else {
        resetOrder();
      }
      while (digitalRead(BUTTON_1) == LOW); // Wait for release
    }
  }

  // Button 2: Select/Add/Confirm Order (double press for confirmation)
  if (digitalRead(BUTTON_2) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_2) == LOW) {
      unsigned long currentTime = millis();
      while (digitalRead(BUTTON_2) == LOW); // Wait for release
      if (waitingForSecondPress && (currentTime - lastButton2Release < doublePressInterval)) {
        // Double press: Trigger confirmation
        if ((inCartView || !inQuantityMode) && !inConfirmMode && cartSize > 0 && !inWelcomeScreen) {
          inConfirmMode = true;
          inCartView = false; // Exit cart view
          displayConfirmDialog();
          Serial.println("Double press detected, showing confirm dialog");
        }
        waitingForSecondPress = false;
      } else {
        // Single press
        waitingForSecondPress = true;
        lastButton2Release = currentTime;
        if (inConfirmMode) {
          submitOrder();
        } else if (!inCartView && !inWelcomeScreen) {
          if (!inQuantityMode) {
            inQuantityMode = true;
            currentQuantity = 1;
            displayQuantityDialog();
          } else {
            addToCart();
          }
        }
      }
    }
  } else {
    // Reset double press if interval exceeded
    if (waitingForSecondPress && (millis() - lastButton2Release >= doublePressInterval)) {
      waitingForSecondPress = false;
    }
  }

  // Button 3: Scroll Up/Increment Quantity
  if (digitalRead(BUTTON_3) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_3) == LOW) {
      if (inQuantityMode) {
        currentQuantity++;
        if (currentQuantity > 10) currentQuantity = 10;
        displayQuantityDialog();
      } else if (inCartView) {
        cartScrollIndex--;
        if (cartScrollIndex < 0) cartScrollIndex = 0;
        displayCart();
      } else if (!inConfirmMode && !inWelcomeScreen) {
        currentMenuIndex--;
        if (currentMenuIndex < 0) currentMenuIndex = menuSize - 1;
        displayMenu();
      }
      while (digitalRead(BUTTON_3) == LOW); // Wait for release
    }
  }

  // Button 4: Scroll Down/Decrement Quantity
  if (digitalRead(BUTTON_4) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_4) == LOW) {
      if (inQuantityMode) {
        currentQuantity--;
        if (currentQuantity < 1) currentQuantity = 1;
        displayQuantityDialog();
      } else if (inCartView) {
        cartScrollIndex++;
        if (cartScrollIndex >= cartSize) cartScrollIndex = max(0, cartSize - 4);
        displayCart();
      } else if (!inConfirmMode && !inWelcomeScreen) {
        currentMenuIndex++;
        if (currentMenuIndex >= menuSize) currentMenuIndex = 0;
        displayMenu();
      }
      while (digitalRead(BUTTON_4) == LOW); // Wait for release
    }
  }
}