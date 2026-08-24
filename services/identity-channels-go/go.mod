module github.com/54link-dev/identity-channels-go

go 1.22

require (
	github.com/IBM/sarama v1.43.3
	github.com/54link-dev/middleware-go v0.0.0
)

replace github.com/54link-dev/middleware-go => ../middleware-go
require github.com/lib/pq v1.10.9
