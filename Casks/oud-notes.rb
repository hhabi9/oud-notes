require_relative "../lib/oud_notes_download_strategy"

cask "oud-notes" do
  version "1.4.2"
  sha256 "eec704d6dc73c6b93dfa16937da032986a72d609b13865a5b2c3ce9fbda836c6"

  url "https://github.com/hhabi9/oud-notes/releases/download/v#{version}/Oud.Notes.dmg",
      using: OudNotesDownloadStrategy
  name "Oud Notes"
  desc "Local Markdown notes with diagrams, themes, and backups"
  homepage "https://github.com/hhabi9/oud-notes"

  depends_on arch: :arm64
  depends_on macos: ">= :monterey"
  depends_on formula: "gh"

  app "Oud Notes.app"

  caveats <<~EOS
    This private release requires `gh auth login` with access to hhabi9/oud-notes.
    Notes are kept in ~/Library/Application Support/Oud Notes when uninstalled.
    This app is ad-hoc signed, not Apple-notarized.
  EOS
end
