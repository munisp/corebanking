# infrastructure/config

`docker.json` is a placeholder. It's the format `docker login` produces
(`~/.docker/config.json`) and what `kubectl create secret docker-registry
--from-file=.dockerconfigjson=...` expects - real credentials don't belong
in git.

To regenerate for real use:

```bash
doctl registry login   # or: docker login registry.digitalocean.com
cp ~/.docker/config.json infrastructure/config/docker.json   # local use only, don't commit
```
