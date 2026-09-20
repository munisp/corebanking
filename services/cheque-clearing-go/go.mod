module github.com/afrong/54link-cheque-clearing-go

go 1.22

require (
	github.com/lib/pq v1.10.9
	tbclient v0.0.0
)

require github.com/tigerbeetle/tigerbeetle-go v0.17.0 // indirect

replace tbclient => ../../pkg/tbclient
