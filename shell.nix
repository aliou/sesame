{
  pkgs ? import <nixpkgs> { },
}:

let
  # Node 25 is needed for --build-sea (single executable applications).
  unstable = import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz") { };
in
pkgs.mkShell {
  buildInputs = [
    unstable.nodejs_25
    pkgs.pnpm_10
    pkgs.sqlite
  ];
}
