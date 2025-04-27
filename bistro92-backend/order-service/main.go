package main

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.temporal.io/sdk/client"

	"github.com/bistro92/backend/order-service/temporal"
)

var temporalClient client.Client

func main() {
	var err error
	temporalClient, err = client.Dial(client.Options{HostPort: "localhost:7233"})
	if err != nil {
		panic(err)
	}
	defer temporalClient.Close()

	err = temporal.InitDB()
	if err != nil {
		panic(err)
	}

	go func() {
		if err := temporal.StartWorker(temporalClient); err != nil {
			panic(err)
		}
	}()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Menu item routes
	r.GET("/menu-items", getMenuItems)
	r.GET("/menu-items/:id", getMenuItem)

	// Table routes
	r.GET("/tables", getTables)
	r.GET("/tables/:number", getTable)

	// Order routes
	r.POST("/orders", createOrder)
	r.GET("/orders", getOrders)
	r.GET("/orders/:id", getOrder)
	r.PATCH("/orders/:id", updateOrder)
	r.DELETE("/orders/:id", deleteOrder)

	r.Run(":8000")
}

// Menu item handlers
func getMenuItems(c *gin.Context) {
	ctx := context.Background()
	items, err := getMenuItemsFromDB(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func getMenuItem(c *gin.Context) {
	ctx := context.Background()
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid menu item ID"})
		return
	}

	item, err := getMenuItemFromDB(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

// Table handlers
func getTables(c *gin.Context) {
	ctx := context.Background()
	tables, err := getTablesFromDB(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tables)
}

func getTable(c *gin.Context) {
	ctx := context.Background()
	number, err := strconv.Atoi(c.Param("number"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid table number"})
		return
	}

	table, err := getTableFromDB(ctx, number)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, table)
}

// Order handlers
func createOrder(c *gin.Context) {
	var order temporal.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	we, err := temporalClient.ExecuteWorkflow(
		context.Background(),
		client.StartWorkflowOptions{
			ID:        fmt.Sprintf("order-%d", time.Now().UnixNano()),
			TaskQueue: "order-queue",
		},
		temporal.OrderWorkflow,
		order,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"workflow_id": we.GetID(),
		"order_id":    order.ID,
		"status":      "Pending",
	})
}

func getOrders(c *gin.Context) {
	ctx := context.Background()
	status := c.Query("status")
	orders, err := temporal.GetOrders(ctx, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func getOrder(c *gin.Context) {
	ctx := context.Background()
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	order, err := temporal.GetOrder(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, order)
}

func updateOrder(c *gin.Context) {
	ctx := context.Background()
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	type UpdateRequest struct {
		Status string `json:"status"`
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start the workflow to update the order status
	we, err := temporalClient.ExecuteWorkflow(
		ctx,
		client.StartWorkflowOptions{
			ID:        fmt.Sprintf("update-order-%d-%d", id, time.Now().UnixNano()),
			TaskQueue: "order-queue",
		},
		temporal.UpdateOrderStatusWorkflow,
		id,
		req.Status,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Wait for the workflow completion
	var result interface{}
	if err := we.Get(ctx, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get the updated order
	order, err := temporal.GetOrder(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

func deleteOrder(c *gin.Context) {
	ctx := context.Background()
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	err = temporal.DeleteOrder(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order deleted successfully"})
}

// Database helper functions for menu items
func getMenuItemsFromDB(ctx context.Context) ([]map[string]interface{}, error) {
	// Implementation to query menu_items table
	db, err := temporal.GetDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, "SELECT id, name, price, category, prep_time, image_url FROM menu_items")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []map[string]interface{}
	for rows.Next() {
		var id int
		var name string
		var price float64
		var category string
		var prepTime int
		var imageURL string

		if err := rows.Scan(&id, &name, &price, &category, &prepTime, &imageURL); err != nil {
			return nil, err
		}

		item := map[string]interface{}{
			"id":       id,
			"name":     name,
			"price":    price,
			"category": category,
			"prepTime": prepTime,
			"imageUrl": imageURL,
		}
		items = append(items, item)
	}

	return items, nil
}

func getMenuItemFromDB(ctx context.Context, id int) (map[string]interface{}, error) {
	db, err := temporal.GetDB()
	if err != nil {
		return nil, err
	}

	var name string
	var price float64
	var category string
	var prepTime int
	var imageURL string

	err = db.QueryRowContext(
		ctx,
		"SELECT name, price, category, prep_time, image_url FROM menu_items WHERE id = $1",
		id,
	).Scan(&name, &price, &category, &prepTime, &imageURL)

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"id":       id,
		"name":     name,
		"price":    price,
		"category": category,
		"prepTime": prepTime,
		"imageUrl": imageURL,
	}, nil
}

// Database helper functions for tables
func getTablesFromDB(ctx context.Context) ([]map[string]interface{}, error) {
	db, err := temporal.GetDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.QueryContext(ctx, "SELECT number, status, capacity FROM tables")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []map[string]interface{}
	for rows.Next() {
		var number int
		var status string
		var capacity int

		if err := rows.Scan(&number, &status, &capacity); err != nil {
			return nil, err
		}

		table := map[string]interface{}{
			"number":   number,
			"status":   status,
			"capacity": capacity,
		}
		tables = append(tables, table)
	}

	return tables, nil
}

func getTableFromDB(ctx context.Context, number int) (map[string]interface{}, error) {
	db, err := temporal.GetDB()
	if err != nil {
		return nil, err
	}

	var status string
	var capacity int

	err = db.QueryRowContext(
		ctx,
		"SELECT status, capacity FROM tables WHERE number = $1",
		number,
	).Scan(&status, &capacity)

	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"number":   number,
		"status":   status,
		"capacity": capacity,
	}, nil
}
