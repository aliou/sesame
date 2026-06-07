{
  description = "sesame - BM25 search for coding agent sessions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    let
      version = "0.10.0";

      binaries = {
        "aarch64-darwin" = {
          url = "https://github.com/aliou/sesame/releases/download/@aliou/sesame-cli@${version}/sesame-darwin-arm64";
          hash = "sha256-rRpNyCi0Ld/YyrU7B/piAXpGAm0pjhHohTVyKXu8pbw="; # darwin
        };
        "aarch64-linux" = {
          url = "https://github.com/aliou/sesame/releases/download/@aliou/sesame-cli@${version}/sesame-linux-arm64";
          hash = "sha256-1w99zm8zYN0W0u2RmP+FNtLe3t8GGfCqAshN4XikR88="; # linux-arm64
        };
        "x86_64-linux" = {
          url = "https://github.com/aliou/sesame/releases/download/@aliou/sesame-cli@${version}/sesame-linux-x64";
          hash = "sha256-I6VPpm00RmhGbfd346mwk4DmWg88CJiZ+IO2sO1U4ro="; # linux-x64
        };
      };

      fetchBinary = pkgs: system:
        let
          binary = binaries.${system} or (throw "Unsupported system: ${system}");
        in
        pkgs.stdenv.mkDerivation {
          pname = "sesame";
          inherit version;

          src = pkgs.fetchurl {
            url = binary.url;
            hash = binary.hash;
          };

          dontUnpack = true;

          installPhase = ''
            mkdir -p $out/bin
            cp $src $out/bin/sesame
            chmod +x $out/bin/sesame
          '';

          meta = with pkgs.lib; {
            description = "BM25 search for coding agent sessions";
            homepage = "https://github.com/aliou/sesame";
            license = licenses.mit;
            platforms = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
            mainProgram = "sesame";
          };
        };
    in
    flake-utils.lib.eachSystem [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        sesame = fetchBinary pkgs system;
      in
      {
        packages = {
          default = sesame;
          sesame = sesame;
          sesame-binary = sesame;
        };

        apps.default = {
          type = "app";
          program = "${sesame}/bin/sesame";
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_25
            pnpm
          ];
        };
      }
    );
}
