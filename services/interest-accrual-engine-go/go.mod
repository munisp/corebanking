module github.com/54link-dev/interest-accrual-engine-go

go 1.21

require github.com/lib/pq v1.12.3

require github.com/munisp/corebanking/pkg/tbclient v0.0.0

require github.com/tigerbeetle/tigerbeetle-go v0.17.0 // indirect

replace github.com/munisp/corebanking/pkg/tbclient => ../../pkg/tbclient
