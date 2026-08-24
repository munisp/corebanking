module github.com/munisp/corebanking/pkg/fundsaga

go 1.21

require github.com/munisp/corebanking/pkg/tbclient v0.0.0

require (
	github.com/lib/pq v1.10.9 // indirect
	github.com/tigerbeetle/tigerbeetle-go v0.17.0 // indirect
)

replace github.com/munisp/corebanking/pkg/tbclient => ../tbclient
