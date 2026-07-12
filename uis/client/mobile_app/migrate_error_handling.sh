#!/bin/bash

# Script to automatically replace all "on DioException catch" with "catch" throughout the Flutter app

echo "🔧 Starting error handling migration..."
echo ""

# Find all Dart files with "on DioException catch"
FILES=$(grep -rl "on DioException catch" lib/)

if [ -z "$FILES" ]; then
    echo "✅ No files found with 'on DioException catch' - migration may already be complete!"
    exit 0
fi

echo "📁 Found files to update:"
echo "$FILES" | while read file; do
    count=$(grep -c "on DioException catch" "$file")
    echo "  - $file ($count instances)"
done
echo ""

# Count total instances
TOTAL=$(echo "$FILES" | wc -l | tr -d ' ')
echo "📊 Total files to update: $TOTAL"
echo ""

# Ask for confirmation
read -p "🤔 Do you want to proceed with the migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🚀 Starting migration..."
echo ""

# Perform the replacement
echo "$FILES" | while read file; do
    echo "  📝 Updating: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Replace "on DioException catch (e)" with "catch (e)"
    # This handles different variable names
    sed -i 's/} on DioException catch (/} catch (/g' "$file"
    sed -i 's/}on DioException catch (/}catch (/g' "$file"
    sed -i 's/on DioException catch (/catch (/g' "$file"
    
    # Count replacements
    BEFORE=$(grep -c "on DioException catch" "$file.backup" || echo "0")
    AFTER=$(grep -c "on DioException catch" "$file" || echo "0")
    REPLACED=$((BEFORE - AFTER))
    
    if [ $REPLACED -gt 0 ]; then
        echo "    ✅ Replaced $REPLACED instances"
    else
        echo "    ⚠️  No replacements made"
    fi
done

echo ""
echo "✨ Migration complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Run tests: flutter test"
echo "  3. If everything looks good, remove backups: rm lib/**/*.backup"
echo "  4. If you need to rollback: for f in lib/**/*.backup; do mv \$f \${f%.backup}; done"
echo ""
echo "💡 Backup files created with .backup extension"
