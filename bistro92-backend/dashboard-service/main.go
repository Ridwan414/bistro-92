package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

var db *sql.DB
var redisClient *redis.Client
var ctx = context.Background()

func main() {
	var err error
	db, err = sql.Open("postgres", "postgres://postgres:secret@localhost:5432/bistro92?sslmode=disable")
	if err != nil {
		panic(err)
	}
	redisClient = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	r := gin.Default()
	r.Use(cors.Default())
	r.GET("/dashboard/metrics", getMetrics)
	r.Run(":5000")
}

func getMetrics(c *gin.Context) {
	cached, err := redisClient.Get(ctx, "dashboard_metrics").Result()
	if err == nil {
		c.JSON(http.StatusOK, json.RawMessage(cached))
		return
	}

	var pendingOrders int
	err = db.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'Pending'").Scan(&pendingOrders)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var totalSales float64
	err = db.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'Completed'").Scan(&totalSales)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get order stats by status
	var completed, canceled int
	err = db.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'Completed'").Scan(&completed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	err = db.QueryRow("SELECT COUNT(*) FROM orders WHERE status = 'Cancelled'").Scan(&canceled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get popular items data
	popularItems := []map[string]interface{}{}
	rows, err := db.Query(`
		WITH item_counts AS (
			SELECT 
				item->>'Name' as name,
				SUM((item->>'Quantity')::int) as count
			FROM 
				orders, 
				jsonb_array_elements(items) AS item
			GROUP BY 
				item->>'Name'
			ORDER BY 
				count DESC
			LIMIT 5
		)
		SELECT name, count FROM item_counts
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		popularItems = append(popularItems, map[string]interface{}{
			"name":  name,
			"count": count,
		})
	}

	metrics := map[string]interface{}{
		"pending_orders": pendingOrders,
		"total_sales":    totalSales,
		"order_stats": map[string]interface{}{
			"completed": completed,
			"pending":   pendingOrders,
			"canceled":  canceled,
		},
		"popular_items": popularItems,
	}
	metricsJSON, _ := json.Marshal(metrics)
	redisClient.Set(ctx, "dashboard_metrics", metricsJSON, 60*time.Second)
	c.JSON(http.StatusOK, metrics)
}
