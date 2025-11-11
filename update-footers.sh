#!/bin/bash

files="contact.html membership.html blog.html digital-solutions.html enrollment.html membership-signup.html submissions.html"

for file in $files; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    
    # Create a backup
    cp "$file" "${file}.bak"
    
    # Use sed to replace the footer sections
    # This is a multi-line replacement, so we'll use a different approach
    # We'll use awk to process the file
    
    awk '
    BEGIN { in_footer_sections = 0; skip = 0 }
    /<div class="footer-section">/ && /<h4>Justice Support<\/h4>/ {
        in_footer_sections = 1
        skip = 1
        next
    }
    /<div class="footer-section">/ && /<h4>DV Class Payments<\/h4>/ {
        skip = 1
        next
    }
    /<\/div>/ && skip == 1 {
        # Check if this closes a footer-section
        if (prev_line ~ /<\/ul>/ || prev_line ~ /<\/p>/ || prev_line ~ /<\/a>/) {
            skip = 0
            next
        }
    }
    skip == 0 { 
        # Replace Community section links
        if (/<h4>Community<\/h4>/) {
            print $0
            getline
            while ($0 !~ /<\/ul>/) {
                if ($0 ~ /membership.html/) print $0
                else if ($0 ~ /contact.html/) print $0
                else if ($0 ~ /<\/li>/ && prev_had_link) {
                    # Skip empty li
                }
                else if ($0 ~ /<li>/) {
                    # Could add newsletter here
                }
                else print $0
                prev_line = $0
                getline
            }
            print "                        <li><a href=\"#newsletter\">Join Our Newsletter</a></li>"
            print $0
            next
        }
        print $0
        prev_line = $0
    }
    ' "$file" > "${file}.tmp"
    
    # Only replace if the tmp file was created successfully
    if [ -s "${file}.tmp" ]; then
      mv "${file}.tmp" "$file"
      echo "Updated $file"
    else
      echo "Error updating $file, restoring backup"
      mv "${file}.bak" "$file"
    fi
    
    # Clean up backup if successful
    rm -f "${file}.bak"
  fi
done
