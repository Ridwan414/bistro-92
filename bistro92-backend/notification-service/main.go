package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/streadway/amqp"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
var clients = make(map[*websocket.Conn]string)

// Event types
const (
	EventNewOrder     = "new_order"
	EventStatusChange = "status_change"
)

// Notification structure
type Notification struct {
	ID          string                   `json:"id"`
	Type        string                   `json:"type"`
	TableNumber int                      `json:"table_number"`
	Status      string                   `json:"status,omitempty"`
	Items       []map[string]interface{} `json:"items,omitempty"`
	AssignedTo  string                   `json:"assigned_to,omitempty"`
	Timestamp   string                   `json:"timestamp"`
	Message     string                   `json:"message,omitempty"`
}

// Track recently sent notifications to prevent duplicates
var recentNotifications = make(map[string]bool)
var recentNotificationsLock = &sync.Mutex{}

// Add notification to recent list with expiration
func trackNotification(id string) {
	recentNotificationsLock.Lock()
	defer recentNotificationsLock.Unlock()

	// Add to recent notifications
	recentNotifications[id] = true

	// Set up expiration after 30 seconds
	go func(notificationID string) {
		time.Sleep(30 * time.Second)
		recentNotificationsLock.Lock()
		defer recentNotificationsLock.Unlock()
		delete(recentNotifications, notificationID)
	}(id)

	// Clean up if we have too many stored
	if len(recentNotifications) > 100 {
		// Just rebuild with the 50 most recent (simple approach)
		// In a production system, you might use a proper cache with LRU policy
		newMap := make(map[string]bool)
		count := 0
		for k, v := range recentNotifications {
			newMap[k] = v
			count++
			if count >= 50 {
				break
			}
		}
		recentNotifications = newMap
	}
}

// Check if we've seen this notification recently
func isRecentNotification(id string) bool {
	recentNotificationsLock.Lock()
	defer recentNotificationsLock.Unlock()
	return recentNotifications[id]
}

func main() {
	c, err := client.Dial(client.Options{HostPort: "localhost:7233"})
	if err != nil {
		log.Fatal(err)
	}
	defer c.Close()

	w := worker.New(c, "notification-queue", worker.Options{})
	w.RegisterActivity(SendNotification)
	go func() {
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Fatal(err)
		}
	}()

	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/client", serveClient)
	go consumeRabbitMQ()

	log.Println("Notification service started on :3001")
	log.Fatal(http.ListenAndServe(":3001", nil))
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for WebSocket
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get room from query parameter
	room := r.URL.Query().Get("room")
	if room == "" {
		// Default to 'orders' room if no room is specified
		room = "orders"
	}

	// Support all valid rooms - kitchen, dashboard, and orders
	if room != "kitchen" && room != "dashboard" && room != "orders" {
		log.Println("Invalid room:", room)
		http.Error(w, "Invalid room", http.StatusBadRequest)
		return
	}

	log.Printf("Attempting WebSocket connection for room: %s", room)

	// Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Register client
	clients[conn] = room
	log.Printf("Client connected to room: %s. Total clients: %d", room, len(clients))

	// Send a welcome message to confirm connection
	welcomeMsg := Notification{
		ID:        time.Now().Format("20060102150405.000000000"),
		Type:      "connection_established",
		Timestamp: time.Now().Format(time.RFC3339),
		Message:   "Connected to notification service",
	}

	welcomeJSON, _ := json.Marshal(welcomeMsg)
	if err := conn.WriteMessage(websocket.TextMessage, welcomeJSON); err != nil {
		log.Printf("Error sending welcome message: %v", err)
	}

	// Clean up on disconnect
	defer func() {
		log.Printf("Client disconnected from room: %s", room)
		delete(clients, conn)
		conn.Close()
	}()

	// Keep the connection alive
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

func consumeRabbitMQ() {
	// Retry connection if it fails
	for {
		err := connectRabbitMQ()
		if err != nil {
			log.Printf("Failed to connect to RabbitMQ: %v. Retrying in 5 seconds...", err)
			time.Sleep(5 * time.Second)
			continue
		}
		break
	}
}

func connectRabbitMQ() error {
	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"order.created",
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return err
	}

	// Also declare a queue for status updates
	statusQ, err := ch.QueueDeclare(
		"order.status",
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return err
	}

	// Consume order created events
	msgs, err := ch.Consume(
		q.Name,
		"",    // consumer
		true,  // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
	if err != nil {
		return err
	}

	// Consume order status update events
	statusMsgs, err := ch.Consume(
		statusQ.Name,
		"",    // consumer
		true,  // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
	if err != nil {
		return err
	}

	// Handle order created messages
	go func() {
		for msg := range msgs {
			var order struct {
				ID          int `json:"id"`
				TableNumber int `json:"table_number"`
				Items       []struct {
					ItemID   int     `json:"ItemID"`
					Name     string  `json:"Name"`
					Quantity int     `json:"Quantity"`
					Price    float64 `json:"Price"`
				} `json:"items"`
				Status     string `json:"status"`
				AssignedTo string `json:"assigned_to"`
				Timestamp  string `json:"timestamp"`
			}
			if err := json.Unmarshal(msg.Body, &order); err != nil {
				log.Println("Error unmarshaling order:", err)
				continue
			}

			// Convert order items format
			var items []map[string]interface{}
			for _, item := range order.Items {
				items = append(items, map[string]interface{}{
					"ItemID":   item.ItemID,
					"Name":     item.Name,
					"Quantity": item.Quantity,
					"Price":    item.Price,
				})
			}

			// Create a stable, unique ID for this new order
			// Format: new_order_{order_id}_{timestamp}
			uniqueID := fmt.Sprintf("new_order_%d_%s",
				order.ID,
				time.Now().Format("20060102150405.000"))

			notification := Notification{
				ID:          uniqueID,
				Type:        EventNewOrder,
				TableNumber: order.TableNumber,
				Status:      order.Status,
				Items:       items,
				AssignedTo:  order.AssignedTo,
				Timestamp:   order.Timestamp,
				Message:     "New order received",
			}

			SendNotification(context.Background(), notification)
		}
	}()

	// Handle status update messages
	go func() {
		for msg := range statusMsgs {
			var statusUpdate struct {
				OrderID     int    `json:"order_id"`
				TableNumber int    `json:"table_number"`
				Status      string `json:"status"`
				AssignedTo  string `json:"assigned_to"`
			}
			if err := json.Unmarshal(msg.Body, &statusUpdate); err != nil {
				log.Println("Error unmarshaling status update:", err)
				continue
			}

			// Create a stable, unique ID for this status update
			// Format: status_change_{order_id}_{status}_{timestamp}
			uniqueID := fmt.Sprintf("status_change_%d_%s_%s",
				statusUpdate.OrderID,
				statusUpdate.Status,
				time.Now().Format("20060102150405.000"))

			// Create a notification for the status change
			notification := Notification{
				ID:          uniqueID,
				Type:        EventStatusChange,
				TableNumber: statusUpdate.TableNumber,
				Status:      statusUpdate.Status,
				AssignedTo:  statusUpdate.AssignedTo,
				Timestamp:   time.Now().Format(time.RFC3339),
				Message:     "Order status changed to " + statusUpdate.Status,
			}

			SendNotification(context.Background(), notification)
		}
	}()

	log.Println("Connected to RabbitMQ and consuming messages")
	// Block indefinitely
	select {}
}

func SendNotification(ctx context.Context, notification Notification) error {
	// Generate a stable ID if one doesn't exist
	if notification.ID == "" {
		notification.ID = time.Now().Format("20060102150405.000000000")
	}

	// Check if we've sent this notification recently
	if isRecentNotification(notification.ID) {
		log.Printf("Duplicate notification detected (ID: %s). Skipping broadcast.", notification.ID)
		return nil
	}

	// Track this notification to prevent duplicates
	trackNotification(notification.ID)

	notificationJSON, err := json.Marshal(notification)
	if err != nil {
		log.Printf("Error marshaling notification: %v", err)
		return err
	}

	log.Printf("Broadcasting notification of type '%s' to %d clients", notification.Type, len(clients))

	// Create a list of failing connections to remove after iteration
	var failedConnections []*websocket.Conn

	// Send to all clients based on room
	for conn, room := range clients {
		// Send to appropriate rooms - send all notifications to 'orders' room
		if room == "orders" ||
			(room == "kitchen" && (notification.Type == EventNewOrder || notification.Type == EventStatusChange)) ||
			(room == "dashboard" && notification.Type == EventNewOrder) {
			if err := conn.WriteMessage(websocket.TextMessage, notificationJSON); err != nil {
				log.Printf("Error sending message to %s client: %v", room, err)
				failedConnections = append(failedConnections, conn)
			}
		}
	}

	// Clean up failed connections
	for _, conn := range failedConnections {
		log.Printf("Removing failed connection for room: %s", clients[conn])
		delete(clients, conn)
		conn.Close()
	}

	if len(failedConnections) > 0 {
		log.Printf("Removed %d failed connections. %d clients remaining.",
			len(failedConnections), len(clients))
	}

	return nil
}

func serveClient(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "client.html")
}
