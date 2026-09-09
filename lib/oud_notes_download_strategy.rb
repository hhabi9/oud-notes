require "download_strategy"

# Download private releases without embedding authentication tokens in cask metadata.
class OudNotesDownloadStrategy < AbstractFileDownloadStrategy
  def fetch(timeout: nil)
    lock = DownloadLock.new(temporary_path)
    begin
      lock.lock_or_wait(quiet: quiet?, timeout: timeout)
      unless cached_location.exist?
        gh = HOMEBREW_PREFIX/"bin/gh"
        raise "Install GitHub CLI with `brew install gh`, then run `gh auth login`." unless gh.executable?

        cached_location.dirname.mkpath
        system_command! gh,
                        args: ["release", "download", "v#{version}",
                               "--repo", "hhabi9/oud-notes", "--pattern", "Oud.Notes.dmg",
                               "--output", temporary_path.to_s, "--clobber"],
                        timeout: timeout
        FileUtils.mv temporary_path, cached_location
      end
      create_symlink_to_cached_download(cached_location)
    ensure
      lock.unlock
    end
  end
end
