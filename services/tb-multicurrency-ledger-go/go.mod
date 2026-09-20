module tb-multicurrency-ledger-go

go 1.21

require github.com/lib/pq v1.10.9

require tbclient v0.0.0

require github.com/tigerbeetle/tigerbeetle-go v0.17.0 // indirect

replace tbclient => ../../pkg/tbclient
