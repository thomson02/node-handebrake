# node-handbrake

A node wrapper for handbrake to encode all video files in a particular folder.

## Usage

First, set up a video profile in handbrake, or use one of the defaults.

```
Usage: encode_folder [options] folder

Options:

  -h, --help                       output usage information
  -v, --version                    output the version number
  -R, --recursive                  Recursively scan directory
  -d, --delete                     Delete the original video on successful encoding
  -f, --force                      Force over-write of existing files
  -k, --keep                       Keep partially encoded files from encoding failures
  -w, --watch                      Watch the folder indefinitely for new video files
  -Z, --preset       <name>        Handbrake video preset (default: Normal)
  -H, --handbrake    <path>        Path to handbrake-cli (default: /Applications/HandBrakeCLI)
  -c, --cpu          <count>       Set CPU count (default: autodetected)
  -x, --extensions   <extensions>  Comma-separated list of file extensions to process (default: [long list])
  -X, --outputext    <ext>         Extension for generated files (default: m4v)
  -O, --outputfolder <folder>      Folder in which to place completed videos (default: same-as-original)
  -s, --recreatestructure'         Recreate input folder structure for output files (default: false)
```

## Sample Execution:

```
Found File: /Users/markkah/Desktop/08:23:2011/Entertainment_i5.mov
Found File: /Users/markkah/Desktop/08:23:2011/Entertainment_i3.mov
Found File: /Users/markkah/Desktop/08:23:2011/Entertainment_i7.mov
Encoding: Entertainment_i5.mov  ✓ Success!
Encoding: Entertainment_i3.mov  ✓ Success!
Encoding: Entertainment_i7.mov   [###########         ] 57.93%  ETA: 1s
```

## My Execution:
This is encode all the files within the input folder (recursive directory search) using the Universal preset and saves the files in the *.mp4 format in the specified output folder. Note that the input folder structure will be recreated in the output folder and the input files will be deleted once successfully converted.

node handbrake.js -R -s -d -Z Universal -O ~/Desktop/output -X mp4 ~/Desktop/input/