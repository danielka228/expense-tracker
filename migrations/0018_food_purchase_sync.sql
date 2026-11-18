-- A linked expense is the financial side of a nutrition product purchase.
-- Removing that expense should remove the linked product purchase as well.
CREATE TRIGGER IF NOT EXISTS sync_food_purchase_on_expense_delete
BEFORE DELETE ON expenses
WHEN EXISTS (SELECT 1 FROM food_entries WHERE expense_id = OLD.id AND user_id = OLD.user_id)
BEGIN
  DELETE FROM food_entries WHERE expense_id = OLD.id AND user_id = OLD.user_id;
END;

-- Keep the product name and purchase date aligned if an expense is edited elsewhere.
CREATE TRIGGER IF NOT EXISTS sync_food_purchase_on_expense_update
AFTER UPDATE OF amount, note, expense_date ON expenses
WHEN EXISTS (SELECT 1 FROM food_entries WHERE expense_id = NEW.id AND user_id = NEW.user_id)
BEGIN
  UPDATE food_entries
  SET name = CASE WHEN NEW.note IS NOT NULL AND trim(NEW.note) <> '' THEN NEW.note ELSE name END,
      entry_date = NEW.expense_date
  WHERE expense_id = NEW.id AND user_id = NEW.user_id;
END;
